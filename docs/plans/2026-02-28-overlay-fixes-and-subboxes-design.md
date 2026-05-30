# CavityReviewOverlay Bug Fixes + Sub-Component Enhancement

**Date:** 2026-02-28
**Status:** Ready for implementation

## Summary

3 bug fixes for CavityReviewOverlay/ImageViewer blank screen issues + 1 enhancement for sub-component child boxes (`attrs.boxes`).

---

## Issue 1: Blank screen when clicking NG objects (cross-frame navigation)

**Root cause:** Clicking an object from a different frame implicitly switches `currentFrame` (via `activeObject.frameSide/frameIndex`), which changes ImageViewer `src` → triggers reset (`imgLoaded=false`). The auto-zoom effect bails because image isn't loaded. Centering effect also bails → blank viewport at translate(0,0).

**Fix:**

### A. CavityReviewOverlay.jsx — Sync frame on object selection
In `handleSelectObject()`: when the selected object belongs to a different frame than `ngFrames[activeFrameIdx]`, explicitly set `activeFrameIdx` to the matching frame index. This ensures frame switch happens intentionally.

```js
const handleSelectObject = useCallback((idx) => {
  const obj = allObjects[idx]
  if (idx === activeObjectIdx) { /* toggle off */ return }

  // Sync frame if object is on a different frame
  const targetFrameIdx = ngFrames.findIndex(
    f => f.side === obj.frameSide && f.frameIndex === obj.frameIndex
  )
  if (targetFrameIdx !== -1 && targetFrameIdx !== activeFrameIdx) {
    setActiveFrameIdx(targetFrameIdx)
  }

  setActiveObjectIdx(idx)
  setFocusTrigger(prev => prev + 1)
  // ...bulk checkbox logic
}, [activeObjectIdx, allObjects, ngFrames, activeFrameIdx])
```

### B. ImageViewer.jsx — Deferred zoom after image load
Add a `pendingZoomRef` that stores the target object index + focusTrigger when the image isn't loaded yet. When `handleImageLoad` fires, check the ref and execute the zoom.

```js
const pendingZoomRef = useRef(null)

// In auto-zoom effect:
if (!imgLoaded || !naturalSize) {
  // Store pending zoom instead of bailing
  pendingZoomRef.current = { activeObjectIndex, focusTrigger }
  return
}
pendingZoomRef.current = null
// ...proceed with zoom math

// In handleImageLoad:
const handleImageLoad = useCallback((e) => {
  setNaturalSize({ width: e.target.naturalWidth, height: e.target.naturalHeight })
  setImgLoaded(true)
  // Pending zoom will be picked up by the effect re-running due to imgLoaded change
}, [])
```

Actually, simpler: the effect already depends on `imgLoaded`. When `imgLoaded` transitions false→true, the effect re-runs. The issue is that `naturalSize` might not be set yet at that point. Need to ensure the effect re-runs when BOTH `imgLoaded` AND `naturalSize` are ready.

**Actual fix:** Add `naturalSize` to the auto-zoom effect deps (it's already there but the timing matters). The key fix is ensuring `setNaturalSize` + `setImgLoaded(true)` in handleImageLoad triggers the effect with both values ready → they're set in the same callback so React batches them → effect sees both.

---

## Issue 2: Blank screen when clicking thumbnails

**Root cause:** Same image load timing issue. Thumbnail click → new frame → new `src` → reset → image loads → centering should fire but translate may be stale.

**Fix (ImageViewer.jsx):**
The centering effect at line 110-127 depends on `[imgLoaded, fitScale, zoom, naturalSize, calcFitScale, isFullscreen]`. When a new image loads:
1. `src` change triggers reset effect → `imgLoaded=false`, `naturalSize=null`, `zoom=1`
2. `handleImageLoad` fires → `naturalSize=set`, `imgLoaded=true`
3. fitScale recalculation effect fires → `fitScale=new value`
4. Centering effect fires because `imgLoaded` + `fitScale` changed

The problem: step 3 runs in a `requestAnimationFrame`, which may execute AFTER the centering effect in step 4 (which also uses rAF). This creates a timing race.

**Fix:** In the centering effect, read `calcFitScale()` directly instead of depending on the stale `fitScale` state:

```js
useEffect(() => {
  if (!imgLoaded || !containerRef.current || !naturalSize) return
  if (zoom === 1) {
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const fs = calcFitScale()  // Already does this ✓
      const imgW = naturalSize.width * fs
      const imgH = naturalSize.height * fs
      setTranslate({
        x: (rect.width - imgW) / 2,
        y: (rect.height - imgH) / 2,
      })
    })
    return () => cancelAnimationFrame(raf)
  }
}, [imgLoaded, fitScale, zoom, naturalSize, calcFitScale, isFullscreen])
```

This already looks correct. The actual issue might be that `imageNaturalSize` prop is passed, which skips the onLoad-based sizing. Let me check... No, `imageNaturalSize` isn't passed from CavityReviewOverlay.

**Refined diagnosis:** The reset effect (line 73-78) sets `naturalSize = imageNaturalSize || null`. Since no `imageNaturalSize` is passed, it becomes `null`. Then `imgLoaded=false`. The centering effect skips (guard: `!imgLoaded`). Good. Then image loads → `naturalSize + imgLoaded` set in one batch → centering effect fires → should center.

Let me trace more carefully: the reset effect runs on `[src, imageNaturalSize]` change. It sets `zoom=1`, `translate={0,0}`, `imgLoaded=false`, `naturalSize=null`. BUT — React batches state updates from effects. So these 4 setState calls are batched. Then `handleImageLoad` fires (browser event, not synchronous) — it sets `naturalSize + imgLoaded`. These trigger:
- fitScale recalculation effect → uses rAF
- centering effect → uses rAF → but needs `fitScale` which hasn't updated yet!

**THE BUG:** Centering effect uses `calcFitScale()` which reads `naturalSize` from state — BUT the fitScale recalculation also uses rAF. The centering effect's rAF may fire BEFORE the fitScale rAF, and reads the OLD fitScale.

BUT — centering effect calls `calcFitScale()` itself, which reads `naturalSize` directly (from state, which IS updated). So `fs = calcFitScale()` should return the correct value... unless `containerRef.current.getBoundingClientRect()` returns 0 dimensions.

**Most likely cause:** Container has 0 dimensions during frame switch because the component is re-rendering. Fix: add a guard for 0-dimension container in centering effect.

Let me just ensure the fix is robust by adding a `setTimeout(0)` fallback.

---

## Issue 3: Remove all bounding box rendering from image views

**Changes to `ImageViewer.jsx`:**
- Remove the entire bbox overlay `<div>` section (lines 346-355)
- Remove `renderBboxes()` function (lines 251-302)
- Keep `objects` prop, `bboxScale` computation, and auto-zoom effect (all needed for invisible navigation)
- Remove `onObjectClick` handler from bbox divs (no more clickable overlays)
- Keep `onObjectClick` prop for future use but it won't be triggered from image clicks

**Changes to `CavityReviewOverlay.jsx`:**
- Remove `onObjectClick` prop from `<ImageViewer>` call (line 844-851)
- Object selection only via right-panel ObjectRow clicks

---

## Enhancement 4: Sub-component children (`attrs.boxes`)

### Data Format (from AI Backend)
```json
{
  "name": "comp-01",
  "box": [x1, y1, x2, y2],
  "label": 1,
  "score": 0.50,
  "attrs": {
    "boxes": [
      [2980.5, 2370.2, 3050.1, 2420.8],
      [3100.0, 2380.5, 3180.3, 2490.2]
    ]
  }
}
```

### CavityReviewOverlay.jsx — allObjects construction

In the `allObjects` useMemo, after creating each parent object entry, check for `attrs.boxes`:

```js
ngFrames.forEach(frame => {
  (frame.objects || []).forEach((obj, objIdx) => {
    const parentEntry = {
      ...obj,
      frameSide: frame.side,
      frameIndex: frame.frameIndex,
      objectIndex: objIdx,
      serialNumber: frame.serial_number,
      imageUrl: frame.image_raw_url || frame.image_url,
      key: objKey(frame.side, frame.frameIndex, objIdx),
      cavityIndex: 0,
      subBoxes: [],  // Will hold child refs
    }
    result.push(parentEntry)

    // Add sub-box children
    const subBoxes = obj.attrs?.boxes || []
    subBoxes.forEach((subBox, subIdx) => {
      if (!subBox || subBox.length < 4) return
      const childEntry = {
        name: `${obj.name}.${subIdx + 1}`,
        box: subBox,
        label: obj.label,
        score: null,  // Sub-boxes don't have individual scores
        frameSide: frame.side,
        frameIndex: frame.frameIndex,
        objectIndex: objIdx,
        serialNumber: frame.serial_number,
        imageUrl: frame.image_raw_url || frame.image_url,
        key: `${objKey(frame.side, frame.frameIndex, objIdx)}-SUB-${subIdx}`,
        cavityIndex: 0,
        isSubBox: true,
        parentKey: parentEntry.key,
        subBoxIndex: subIdx,
      }
      parentEntry.subBoxes.push(childEntry.key)
      result.push(childEntry)
    })
  })
})
```

**Important:** Sub-boxes are NOT independently reviewable. They inherit parent's OK/NG decision. They exist for:
1. Displaying sub-region coordinates in the list
2. Auto-zoom navigation to specific sub-regions

### ObjectRow — Expandable children

Parent rows with `subBoxes.length > 0` show:
- Expand/collapse chevron icon
- Badge showing sub-box count (e.g., "2")
- When expanded: indented child rows below with:
  - Name: `comp-01.1`, `comp-01.2` etc.
  - Coordinate display: `[2981, 2370, 3050, 2421]`
  - Click to zoom to sub-box area
  - No OK/NG buttons (follows parent)

### ImageViewer — Auto-zoom to sub-box

When a sub-box entry is selected (`activeObjectIndex` points to a sub-box):
- The zoom calculation uses the sub-box's `[x1,y1,x2,y2]` coordinates
- Smaller area → higher zoom level (40% viewport fill rule)
- No visible bbox drawn (removed in Issue 3)

---

## Implementation Phases

### Phase 1: Fix ImageViewer timing (Issues 1 & 2)
**Files:** `components/common/ImageViewer.jsx`
- Add deferred zoom pattern for when image isn't loaded yet
- Ensure centering works reliably on frame switch
- Add container dimension guard

### Phase 2: Fix cross-frame object selection (Issue 1)
**Files:** `components/inspection/CavityReviewOverlay.jsx`
- Sync `activeFrameIdx` in `handleSelectObject()` when object is on different frame
- Ensure frame switch + zoom happen in correct order

### Phase 3: Remove bbox rendering (Issue 3)
**Files:** `components/common/ImageViewer.jsx`, `components/inspection/CavityReviewOverlay.jsx`
- Remove `renderBboxes()` and overlay divs from ImageViewer
- Remove `onObjectClick` prop from CavityReviewOverlay's ImageViewer usage
- Keep coordinate math for auto-zoom navigation

### Phase 4: Add sub-component children (Enhancement 4)
**Files:** `components/inspection/CavityReviewOverlay.jsx`
- Extend `allObjects` to include sub-box entries with `isSubBox` flag
- Add expandable children UI to ObjectRow component
- Wire up auto-zoom for sub-box clicks
- Display coordinates for sub-box rows
- Sub-boxes follow parent decision (not independently reviewable)

# Multi-Cavity PCB Inspection - Technical Design

**Date:** 2026-02-08
**Status:** Draft
**Author:** Claude Code + JB

## Overview

The current HMI treats 1 inspection cycle as 1 board. In reality, a panel contains multiple PCBs (cavities). This design adds multi-cavity support: per-cavity confirmation, correct progress counting, full-screen review overlay, and auto-expand for auto-NG mode.

## Key Concepts

### Cavity & Panel
- A **panel** is the physical board that enters the conveyor
- A panel contains N **cavities** (individual PCBs) — configured per board/model
- 1 inspection event from backend = 1 physical PCB = 1 serial number
- For a 6-cavity panel, backend sends **6 inspection events** in rapid succession

### Frame vs PCB
- **Frame** = 1 camera capture (thumbnail in UI)
- 1 PCB can span **multiple frames** (large PCB = 4 frames)
- Frames are NOT the same as cavities — don't assume 1 frame = 1 PCB

### Top + Bottom Pairing
- Each PCB has a top side + bottom side
- Pairing is done by **serial_number** (same serial = same physical PCB)
- A PCB is **GOOD** only if ALL frames (top + bottom) are GOOD
- A PCB is **NG** if ANY frame has a confirmed defect

## Section 1: Database & API — Cavity Count

### Database Change
```sql
ALTER TABLE boards ADD COLUMN cavity_count INTEGER DEFAULT 1 CHECK (cavity_count >= 1);
```

### API Changes
- `POST /api/master-data/boards` — accept `cavityCount` field
- `PATCH /api/master-data/boards/[id]` — can update `cavityCount`
- `GET /api/ai/boards` and `GET /api/ai/boards/[id]` — return `cavity_count`

### Zod Schema (new, in `lib/validations/schemas.js`)
```js
export const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  customerId: z.string().min(1),
  cavityCount: z.number().int().min(1).default(1),
  // existing optional fields...
})
```

### UI Change — `/engineering/master-data` page
- Add **"Cavity Count"** number input (min=1) in board create/edit form
- Display cavity count column in board list table

### Files to modify
| File | Change |
|------|--------|
| `docs/DATABASE_SCHEMA.md` | Add `cavity_count` column |
| `lib/validations/schemas.js` | Add `createBoardSchema` |
| `app/api/master-data/boards/route.js` | Accept `cavityCount` in POST |
| `app/api/master-data/boards/[id]/route.js` | Accept `cavityCount` in PATCH |
| `app/api/ai/boards/route.js` | Return `cavity_count` |
| `app/api/ai/boards/[id]/route.js` | Return `cavity_count` |
| `app/engineering/master-data/page.js` | Add cavity count input + table column |

---

## Section 2: Inspection Queue & Per-PCB Confirmation

### Problem
Backend sends N inspection events (1 per cavity) almost simultaneously after processing a panel. HMI must queue and process one by one.

### New state in `useLiveInspection.js`
```js
// Queue for rapid-fire inspection events
const inspectionQueue = useRef([])

// Current PCB being displayed for confirmation
const [activeInspection, setActiveInspection] = useState(null)

// Track progress per panel cycle
const [panelProgress, setPanelProgress] = useState({
  total: 0,        // total PCBs received in this cycle
  confirmed: 0,    // PCBs already confirmed
  good: 0,
  ng: 0,
})
```

### Flow
```
Backend → SSE inspection event (PCB #1) → push to queue
Backend → SSE inspection event (PCB #2) → push to queue
Backend → SSE inspection event (PCB #3) → push to queue
... (6 events in ~100ms)

Queue processing:
1. Dequeue PCB #1 → set as activeInspection
2. If AI says GOOD (label=false on all frames) → auto-confirm, dequeue next
3. If AI says NG (any frame label=true) → show to operator, wait for confirmation
4. After operator confirms all NG frames → dequeue PCB #2
5. ... repeat until queue empty
6. All confirmed → update progress counters (+6)
```

### Confirmation per frame
- `label: false` (GOOD) → `user_confirmation: "GOOD"` automatic, no action needed
- `label: true` (NG) → operator must confirm:
  - **NG button** → `user_confirmation: "REAL NG"`
  - **GOOD button** → `user_confirmation: "<reason>"` + insert override record

### Queue indicator
Display "PCB 3/6" in UI so operator knows review position.

### Files to modify
| File | Change |
|------|--------|
| `hooks/useLiveInspection.js` | Add inspection queue, panel progress tracking |
| `components/inspection/LiveViewV3.jsx` | Consume queue, drive confirmation flow |

---

## Section 3: Full-Screen Review Overlay

### New component: `components/inspection/CavityReviewOverlay.jsx`

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  PCB 3/6  │  SN: PCBA-10011  │  Auto-NG: 10s ⏱        │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│     TOP SIDE         │        BOTTOM SIDE               │
│     Frame 1/4        │        Frame 1/3                 │
│                      │                                  │
│   [image + defect    │   [image + defect                │
│    bounding boxes]   │    bounding boxes]               │
│                      │                                  │
│  ◄ ►  thumbnails     │  ◄ ►  thumbnails                │
├──────────────────────┴──────────────────────────────────┤
│                                                         │
│       [ ✓  GOOD  (G) ]          [ ✕  NG  (N) ]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Features
- **Header:** queue position (PCB 3/6), serial number, countdown timer (auto-NG mode)
- **Body:** split view top + bottom side of same PCB. Each side can navigate between frames via thumbnail strip
- **Footer:** 2 large glove-friendly buttons:
  - **GOOD** → false call, needs reason input/dropdown → `user_confirmation: "<reason>"` + insert override
  - **NG** → real NG, confirm immediately → `user_confirmation: "REAL NG"`, next PCB
- **Keyboard shortcuts:** `G` = GOOD, `N` = NG
- Overlay appears automatically when auto-NG is ON, or when operator clicks an NG thumbnail

### Trigger conditions
1. **Auto-NG ON:** overlay opens automatically for each NG PCB in queue
2. **Manual mode:** operator clicks NG thumbnail at bottom → overlay opens for that PCB
3. **Queue auto-advance:** after confirm, overlay closes → 500ms delay → opens next NG PCB

### Files to create/modify
| File | Change |
|------|--------|
| `components/inspection/CavityReviewOverlay.jsx` | **NEW** — full-screen overlay component |
| `components/inspection/LiveViewV3.jsx` | Integrate overlay, trigger logic |

---

## Section 4: Auto-Expand Flow (Auto-NG Mode)

### Flow per panel cycle when auto-NG is ON
```
Panel enters → 6 inspection events queued
  │
  ▼
PCB #1: AI = GOOD → auto-confirm, skip (no expand)
PCB #2: AI = NG   → AUTO-EXPAND full-screen overlay
  │                   10 second countdown starts
  │                   ├─ Operator clicks GOOD → cancel timer, enter reason
  │                   └─ Timeout → auto-confirm NG, close overlay
  ▼
PCB #3: AI = GOOD → auto-confirm, skip
PCB #4: AI = NG   → AUTO-EXPAND... (repeat)
  ...
PCB #6: done → update counters (+6 completed)
```

### Key behaviors
- **GOOD PCBs skipped** — no expand, auto-confirm immediately
- **NG PCBs auto-expand** one by one with **10 second** countdown
- **Operator can interrupt** anytime by clicking GOOD
- **Transition between PCBs:** after confirm/timeout, overlay closes → 500ms delay → next overlay opens
- **Queue indicator** always visible: "PCB 3/6" in overlay header

### Manual mode (auto-NG OFF)
Same flow but without countdown. Operator **must** click GOOD or NG for every NG PCB.

---

## Section 5: Counting Logic Overhaul

### Per-PCB status determination
```js
function getPCBStatus(inspection, confirmations) {
  const allFrames = inspection.results || []
  const ngFrames = allFrames.filter(f => f.label === true)

  // PCB = GOOD if all NG frames were overridden to GOOD (false call)
  // PCB = NG if any frame remains confirmed NG
  const hasRealNG = ngFrames.some(f =>
    confirmations[f.frame_id] === 'REAL NG'
  )
  return hasRealNG ? 'ng' : 'good'
}
```

### Counter update per panel cycle
After all PCBs in panel are confirmed:
```js
const panelResult = {
  completedQty: cavityCount,    // e.g. 6
  goodQty: 4,                   // PCBs with all frames GOOD
  ngQty: 2,                     // PCBs with any REAL NG
  falseCallQty: 3,              // total frames overridden to GOOD
}
```

### Formulas
| Metric | Formula | Unit |
|--------|---------|------|
| **Progress** | `completedQty / lotSize` | per physical PCB |
| **Yield** | `goodQty / completedQty × 100%` | per physical PCB |
| **Cycle/PCB** | `panelElapsedTime / cavityCount` | seconds per PCB |

### UI label change
```
PROGRESS 246/10000  │  ✓ 198  │  ✕ 48  │  YIELD 80.5%  │  CYCLE/PCB 5.2s
```

**"CYCLE"** renamed to **"CYCLE/PCB"** to avoid confusion with panel cycle time.

### Files to modify
| File | Change |
|------|--------|
| `components/inspection/LiveViewV3.jsx` | Counter logic, yield formula, cycle time calc |
| `hooks/useLiveInspection.js` | Panel timing, queue completion detection |

---

## Section 6: Defect Counting Bug Fix

### Current bug
Defect count per frame is incorrect. Current logic in `SidePanel.jsx`:
```js
const getDefectCount = (objs) => objs.filter(o => o.label === 1).length
```

### Potential root causes to investigate
1. **`label` type mismatch** — Backend uses `label: true/false` (boolean) at result level, but object level may use `label: 1/0` (integer). Strict equality `=== 1` misses `=== true`.
2. **Objects without label field** — `undefined === 1` returns false → defects not counted.
3. **Counting scope confusion** — counting per frame vs per PCB.

### Fix approach
```js
// Robust defect filter handling both boolean and integer
const isDefect = (obj) => obj.label === 1 || obj.label === true

const getDefectCount = (objs) => (objs || []).filter(isDefect).length
```

### Investigation needed
- Trace actual SSE event data structure from backend
- Compare `label` values at object level vs result level
- Verify defect badges match actual objects in frame

### Files to modify
| File | Change |
|------|--------|
| `components/inspection/SidePanel.jsx` | Fix defect filter logic |
| `hooks/useLiveInspection.js` | Verify frame data transformation |

---

## Section 7: Backend Integration — New Fields

### New fields from SSE inspection event

| Field | Level | Purpose |
|-------|-------|---------|
| `serial_number` | `results[]` | PCB serial — same for all results in 1 inspection |
| `raw_url` | `results[]` | Original image without AI overlay |
| `user_confirmation` | `results[]` | Confirmation status (see logic below) |
| `attrs` | `results[].objects[]` | Extra AI attributes (e.g. label reader texts) |

### Confirmation state machine per frame

```
AI Result    → Initial user_confirmation
─────────────────────────────────────────
label=false  → "GOOD" (auto, no review needed)
label=true   → null (waiting for operator)

Operator Action         → user_confirmation      → Side Effect
─────────────────────────────────────────────────────────────────
Confirm NG              → "REAL NG"              → UPDATE inspection_results
Claim False Call+reason → "<reason text>"        → UPDATE inspection_results
                                                   + INSERT overrides (status=pending)

Manager Action   → user_confirmation    → Side Effect
──────────────────────────────────────────────────────
Approve override → unchanged (reason)  → UPDATE overrides.status = 'approved'
Reject override  → revert "REAL NG"   → UPDATE overrides.status = 'rejected'
                                        + UPDATE inspection_results
```

### API calls per frame confirmation

| Action | API Call | Payload |
|--------|----------|---------|
| NG (Real NG) | `PUT /api/inspection-results/{id}` | `{ user_confirmation: "REAL NG" }` |
| GOOD (False Call) | `PUT /api/inspection-results/{id}` + `POST /api/overrides` | `{ user_confirmation: "<reason>" }` + override record |

### Override record scope
Overrides are now **per-frame** (not per inspection). The `overrides` table needs to reference `inspection_result_id` + `frame_id` so the manager knows which specific frame was overridden.

### Files to modify
| File | Change |
|------|--------|
| `hooks/useLiveInspection.js` | Parse new fields from SSE |
| `lib/services/aiBackendService.js` | Verify SSE event parsing handles new fields |
| `components/inspection/LiveViewV3.jsx` | Display serial_number, use raw_url |
| `components/inspection/CavityReviewOverlay.jsx` | Show serial_number, confirmation buttons |
| `app/api/overrides/route.js` | Accept frame_id in override creation |
| `lib/validations/schemas.js` | Update override schema for frame_id |

---

## Implementation Priority

| Order | Task | Complexity | Dependencies |
|-------|------|------------|--------------|
| 1 | Database: Add `cavity_count` to boards | Low | None |
| 2 | UI: Board creation form with cavity count | Low | Task 1 |
| 3 | Bug fix: Defect counting per frame | Low | None |
| 4 | Parse new SSE fields (serial_number, raw_url, user_confirmation) | Medium | None (backend ready) |
| 5 | Inspection queue in useLiveInspection | High | Task 4 |
| 6 | CavityReviewOverlay component | High | Task 5 |
| 7 | Per-cavity confirmation flow | High | Task 5, 6 |
| 8 | Auto-expand with 10s timer | Medium | Task 6, 7 |
| 9 | Counting logic overhaul (progress, yield, cycle/PCB) | Medium | Task 5, 7 |

---

## Answered Questions

1. **Serial number availability** — **READY NOW.** `serial_number` already exists in `ImageResult` model and is emitted in SSE events. Mock server (`dev.py`) generates it. Production (Auto Inspect Edge) sends it from AI Engine.

2. **Inspection result API** — Simple `user_confirmation` updates can go directly via PostgREST:
   ```
   PATCH http://localhost:3001/inspection_results?id=eq.{uuid}
   Body: { "user_confirmation": "REAL NG" }
   ```
   For false call workflow (update `inspection_results` + insert `overrides` atomically), a **dedicated Next.js API endpoint is needed**: `PUT /api/inspection-results/[id]/confirm`.

3. **Override schema** — **Already done.** Columns `inspection_id`, `frame_id`, `side`, `position` were added via migration 028.

4. **Backward compatibility** — **No separate "single-board mode".** Even with `cavity_count = 1`, a PCB can have multiple frames (large PCB > camera field of view). The queue/confirmation flow is always the same regardless of cavity count. `cavity_count` only affects how many inspection events to expect per panel cycle.

5. **Manager override review** — **Yes, per-frame.** Manager sees the specific frame image that was claimed as false call. Image URL from `local_image_path` / `cloud_image_url` in overrides table. The `frame_id`, `side`, `position` columns (migration 028) provide the reference.

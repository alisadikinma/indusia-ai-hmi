# HMI Improvements Design

**Date:** 2026-02-05
**Status:** Approved
**Scope:** Items 1-4, 6-7 (Item 5 deferred)

---

## Overview

Seven improvements to the INDUSIA AI HMI, prioritized into three groups:

| Group | Items | Description |
|-------|-------|-------------|
| A | 3, 4, 7 | Model selection flow |
| B | 6 | Parallel inspection progress bars |
| C | 1, 2 | Serial sim removal + offline fonts |

Item 5 (image sync for `url` + `raw_url`) is deferred.

---

## Group A: Model Selection Flow (Items 3, 4, 7)

### Context

- Model list lives in HMI's PostgreSQL `ai_models` table
- AI Backend is a consumer of HMI's model list, not the source
- Current code hardcodes model to `'pcb_1'` in `useLiveInspection.js:170`
- Existing `GET /api/ai/models` uses `withApiKeyAuth` (AI Backend only)

### Data Flow

```
HMI Database (ai_models table)
    |                          |
    v                          v
GET /api/inspection/models     GET /api/ai/models
(withAuth - browser)           (withApiKeyAuth - AI Backend)
    |                          |
    v                          v
Select Line Page           AI Backend (port 8002)
(operator picks model)     (fetches available models)
```

### Changes

#### 1. New API route: `GET /api/inspection/models`

- **File:** `app/api/inspection/models/route.js` (new)
- Auth: `withAuth()` (browser/operator access)
- Queries `modelsRepo.listModels({ status: 'active' })` from `ai_models` table
- Returns: `{ success: true, data: [{ id, name, version, status, framework, map50 }] }`
- Only returns models with `status = 'active'` (deployable models)

#### 2. Model dropdown on LineCard

- **File:** `app/inspection/select-line/page.js`
- Fetch model list on page mount from `GET /api/inspection/models`
- Add `<select>` dropdown inside each `LineCard` component
- State: `selectedModels` Map (lineId -> modelName)
- START INSPECTION button disabled when `!selectedModels.get(lineId)`
- Persist last-used model per line: `localStorage` key `indusia_line_model_{lineId}`
- Pre-select stored model on load (if still in active models list)

#### 3. Pass model through inspection start chain

- **File:** `hooks/useLiveInspection.js`
  - Accept `modelName` prop (remove hardcoded `'pcb_1'`)
  - `initSession()` calls `selectModel(modelName)` with the operator's choice
  - `runProcess()` passes model to `startInspection({ reason, model: modelName })`

- **File:** `lib/services/aiBackendService.js`
  - Update `startInspection(options)` to accept `model` parameter
  - Send as query param: `POST /api/inspection/start?reason=...&model={modelName}`

- **File:** `app/inspection/select-line/page.js`
  - `handleStartInspection()` passes selected model to route or AuthContext
  - Store in route query param or AuthContext for LiveView to consume

#### 4. Existing endpoint unchanged

- `GET /api/ai/models` stays with `withApiKeyAuth` for AI Backend consumption
- No changes to `aiModelsRepo` or `modelsRepo`

### localStorage Schema

```
Key:   indusia_line_model_{lineId}
Value: { modelName: "pcb_1", modelId: "uuid", selectedAt: "ISO date" }
```

---

## Group B: Parallel Inspection Progress Bars (Item 6)

### Context

- `InspectionStage.jsx` renders 20 stages linearly: TOP -> FLIP -> BTM -> AI TOP -> AI BTM
- In reality, PLC motion and AI vision run with staggered overlap
- PLC captures TOP -> AI starts TOP processing -> PLC flips -> PLC captures BTM -> AI starts BTM
- Single linear progress bar makes it look like progress jumps back and forth

### Design: Dual-Row Layout

```
+-----------------------------------------------------+
|  PLC Motion Track                                    |
|  [gear] TOP       [gear] FLIP    [gear] BTM         |
|  [*][*][*][*]      [*]          [*][*][*][*]         |
|   4 stages          1 stage       4 stages           |
+-----------------------------------------------------+
|  AI Vision Track                                     |
|  [cpu] AI TOP                    [cpu] AI BTM        |
|  [*][*][o][.][.][.]              [.][.][.][.][.][.]  |
|   6 stages                        6 stages           |
+-----------------------------------------------------+
         * = completed   o = active   . = pending
```

### Changes

#### 1. Replace `groupStagesByPhase()` with `splitByTrack()`

- **File:** `components/inspection/InspectionStage.jsx`
- New function `splitByTrack(stages)` returns:
  ```js
  {
    motion: [
      { key: 'top', stages: [...] },
      { key: 'flip', stages: [...] },
      { key: 'bottom', stages: [...] }
    ],
    vision: [
      { key: 'ai_top', stages: [...] },
      { key: 'ai_bottom', stages: [...] }
    ]
  }
  ```
- Split logic: `stage.type === 'motion'` goes to motion track, `stage.type === 'vision'` goes to vision track
- Within each track, group by phase using same side/stage logic as before

#### 2. Dual stage index tracking

- **File:** `hooks/useLiveInspection.js`
- Replace single `stageIndex` with two independent indices:
  - `motionStageIndex` - updated by `motion_stages` SSE events
  - `visionStageIndex` - updated by `vision_stages` SSE events
- Both SSE streams already exist and fire independently
- Expose both indices to `InspectionStage` component

#### 3. Render two rows

- **File:** `components/inspection/InspectionStage.jsx`
- Top row: PLC Motion Track with `motionStageIndex`
  - Label icon: gear/cog
  - Phase groups: TOP, FLIP, BTM
  - Color: `border-indusia-primary/40` (existing)
- Bottom row: AI Vision Track with `visionStageIndex`
  - Label icon: cpu/brain
  - Phase groups: AI TOP, AI BTM
  - Color: `border-purple-500/40` (existing)
- Optional: subtle vertical dashed connector between tracks showing dependency

#### 4. Track labels

- Left side of each row shows track name:
  - Row 1: "PLC" with gear icon
  - Row 2: "AI" with cpu icon
- Existing `PHASE_CONFIG` colors and icons reused within each row

### Stage Count

- Total: 20 stages (fetched from AI Backend via `GET /api/model/stages`)
- Motion track: ~9 stages (4 top + 1 flip + 4 bottom)
- Vision track: ~12 stages (6 ai_top + 6 ai_bottom)
- Actual counts depend on AI Backend stage definitions

---

## Group C: Cleanup + Offline (Items 1 & 2)

### Item 1: Remove Serial Simulator Calls

#### Delete function

- **File:** `lib/services/aiBackendService.js`
- Delete `triggerSimReady()` function (lines 658-680)
- Delete export from module

#### Remove call sites

- **File:** `hooks/useLiveInspection.js`
- Remove call in `runProcess()` (lines 582-587) - the setTimeout + triggerSimReady after starting
- Remove call in `confirmInspection()` (line 718) - triggerSimReady after confirm
- Remove import of `triggerSimReady` from aiBackendService

#### Rationale

- In production, PLC sends READY signals automatically when a board arrives
- The simulator endpoint (`POST /serial/sim/in`) only exists on the AI Backend in simulation mode
- HMI should not be responsible for triggering PLC simulation signals

### Item 2: Offline Fonts

#### Fix A: Google Fonts CSS @import

- **File:** `app/globals.css` (line 1)
- **Action:** Remove `@import url('https://fonts.googleapis.com/...')`
- Download `.woff2` files:
  - JetBrains Mono: weights 300, 400, 500, 600, 700, 800
  - Barlow Condensed: weights 400, 500, 600, 700, 800
  - Barlow: weights 400, 500, 600, 700
- Place in `public/fonts/{family}/`
- Add `@font-face` declarations in `globals.css`:
  ```css
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  /* ... repeat for each weight/family */
  ```

#### Fix B: Next.js Inter font

- **File:** `app/layout.js` (line 2)
- **Action:** Change `import { Inter } from 'next/font/google'` to `next/font/local`
- Download Inter `.woff2` files to `public/fonts/inter/`
- Configure:
  ```js
  import localFont from 'next/font/local'
  const inter = localFont({
    src: [
      { path: '../public/fonts/inter/Inter-Regular.woff2', weight: '400' },
      { path: '../public/fonts/inter/Inter-Medium.woff2', weight: '500' },
      // ... etc
    ],
    variable: '--font-inter'
  })
  ```

#### Fix C: CSP cleanup

- **File:** `next.config.js`
- Remove `https://fonts.googleapis.com` from `style-src`
- Remove `https://fonts.gstatic.com` from `font-src`
- Keep `https://unpkg.com` in `/docs` path CSP (Swagger already self-hosted, CSP is harmless)

### Result

Zero external network requests on page load. HMI works fully offline with:
- Next.js on localhost:3000
- PostgREST on localhost:3001
- AI Backend on localhost:8002

---

## Deferred: Item 5 (Image Sync for url + raw_url)

Not included in this design. To be addressed separately:
- Both `image_url` (display) and `image_raw_url` (original) need uploading to Supabase during sync
- Should be grouped together as one inspection unit
- Current sync only handles override images, not inspection frame images

---

## Files Modified Summary

| File | Group | Change |
|------|-------|--------|
| `app/api/inspection/models/route.js` | A | New - browser-accessible model list endpoint |
| `app/inspection/select-line/page.js` | A | Add model dropdown, disable START without model |
| `hooks/useLiveInspection.js` | A, B, C | Accept modelName prop, dual stage index, remove triggerSimReady |
| `lib/services/aiBackendService.js` | A, C | Add model param to startInspection, delete triggerSimReady |
| `components/inspection/InspectionStage.jsx` | B | Dual-row layout with splitByTrack() |
| `app/globals.css` | C | Replace CDN @import with local @font-face |
| `app/layout.js` | C | Switch Inter to next/font/local |
| `next.config.js` | C | Remove Google Fonts from CSP |
| `public/fonts/` | C | New - self-hosted font files |

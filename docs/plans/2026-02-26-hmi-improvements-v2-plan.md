# HMI Improvements V2 - Implementation Plan

**Date:** 2026-02-26
**Total Items:** 12 improvements (3 tiers)

---

## Summary

| # | Improvement | Tier | Est. Complexity |
|---|-------------|------|----------------|
| 2 | Dropdown refresh after create Customer/Section | A | Low |
| 4 | Rename Board tab → Board/Model | A | Low |
| 5 | Role Management loading animation | A | Low |
| 1 | Force complete WO with reason + user ID | B | Medium |
| 3 | Block starting WO when model has active WO | B | Medium |
| 7 | Auto-update toggle in System Update | B | Medium |
| 12 | Customer logo upload (base64) | B | Medium |
| 8 | Override review per-object + image zoom | C | High |
| 9 | Click object to zoom to PCB coordinates | C | High |
| 10 | Override appeal mechanism (manager, 1x) | C | High |
| 11 | Live inspection per-object review + zoom | C | High |

**Skipped:** #6 (Section multi-select in Add User) - already uses checkboxes, confirmed OK.

---

## Tier A: Quick Fixes

### #2 - New Customer/Section Not Appearing in Dropdown

**Problem:** User reports new Customer/Section not showing in dropdown after creation.

**Investigation:** Code at `app/engineering/master-data/page.js:131` already calls `refreshMasterData()` after save. Possible causes:
- The dropdown being referenced is on a **different page** (e.g., Work Order form, Line creation form on another tab)
- PostgREST caching returning stale data
- `useMasterData()` hook batch API returning cached response

**Files to modify:**
- `app/engineering/master-data/page.js` — Verify refresh is called and works correctly
- `hooks/useMasterData.js` — Ensure `refreshMasterData()` busts any cache
- `lib/supabaseClient.js` — Confirm `cache: 'no-store'` is set (per MEMORY.md fix)

**Implementation:**
1. Debug: Add console.log in `refreshMasterData()` to confirm it fires and returns updated data
2. If batch API caches: ensure `fetch` uses `cache: 'no-store'` headers
3. If other pages affected: ensure WO form also uses `useMasterData()` and gets fresh data
4. Test: Create new customer → switch to Lines tab → verify customer appears in dropdown

**Acceptance criteria:**
- New customer appears immediately in Lines tab customer dropdown
- New section appears immediately in Lines tab section dropdown
- No page refresh needed

---

### #4 - Rename Board Tab → Board/Model

**Problem:** Tab label says "Boards" but should say "Board/Model" since boards ARE the model identifiers.

**Files to modify:**
- `i18n/en.json` — Change `masterData.boards` from "Boards" to "Board / Model"
- `i18n/id.json` — Change `masterData.boards` from Indonesian equivalent to "Board / Model"
- `app/engineering/master-data/page.js:107` — Already uses `t('masterData.boards')` for tab label

**Implementation:**
1. Update `i18n/en.json` line 265: `"boards": "Board / Model"`
2. Update `i18n/id.json` equivalent key
3. Tab label at line 107 will auto-update via i18n

**Note:** The card title at line 718 already uses `t('masterData.boardsModels')` = "Boards / Models" — leave as-is or align.

**Acceptance criteria:**
- Tab label shows "Board / Model" in both EN and ID locales

---

### #5 - Role Management Loading Animation

**Problem:** Role Management page (`/super-admin/roles`) doesn't show Indusia loading animation while data loads.

**Files to modify:**
- `app/super-admin/roles/page.js` — Add loading state check

**Current state:** `loading` is destructured from `useRoles()` on line 18 but never used. Page renders immediately.

**Implementation:**
1. Add loading check after hooks, before access check:
```jsx
// After line 18
if (loading) return <PageLoading />;
```
2. Import `PageLoading` from `@/components/common/PageLoading`

**Note:** The access check at line 31 (`if (!user || user.role !== 'superadmin')`) must come AFTER the loading check to avoid flash of "Access Denied" while auth is still loading.

**Acceptance criteria:**
- Indusia logo loading animation shows while roles data is fetching
- No flash of "Access Denied" during initial load

---

## Tier B: Medium Complexity

### #1 - Force Complete WO with Reason + User Tracking

**Problem:** When completing a WO that isn't 100% done, need to capture reason for force completion and record who completed it.

**Current state:** `ConfirmDialog` in `app/engineering/work-orders/page.jsx:39-83` is a simple confirm/cancel dialog with no input fields.

**Files to modify:**
- `app/engineering/work-orders/page.jsx` — Enhance ConfirmDialog for complete action to include reason textarea
- `app/api/work-orders/[id]/complete/route.js` — Accept `reason` and `completed_by` in request body
- `lib/repos/workOrderRepo.js` — Update `complete()` to save reason and user
- `migrations/0XX_add_wo_completion_fields.sql` — Add columns

**DB Migration:**
```sql
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completion_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id);
```

**Implementation:**
1. Create migration `migrations/0XX_add_wo_completion_fields.sql`
2. Update `ConfirmDialog` in work-orders page:
   - When `type === 'complete'` and progress < 100%, show textarea for reason (required)
   - When progress === 100%, reason is optional (normal completion)
   - Show current progress: "12/100 (12%) — Reason required for incomplete WO"
3. Update API route to accept `{ reason, completed_by }` in POST body
4. Update repo to write `completion_reason` and `completed_by` columns
5. Show completion info in WO detail/history view

**Acceptance criteria:**
- Completing WO with progress < 100% requires a reason
- Completing WO with progress = 100% allows optional reason
- `completed_by` user ID is always recorded
- Completion reason visible in WO list/detail

---

### #3 - Block Starting WO When Model Has Active WO

**Problem:** Starting a new WO should be blocked if another WO for the same board/model on the same line is already active.

**Current state:** API at `/api/work-orders/[id]/start/route.js` validates the WO itself but doesn't check for other active WOs on the same line+model.

**Files to modify:**
- `app/api/work-orders/[id]/start/route.js` — Add validation query
- `app/engineering/work-orders/page.jsx` — Show descriptive error message
- `lib/repos/workOrderRepo.js` — Add `findActiveByLineAndBoard(lineId, boardId)` method

**Implementation:**
1. In `workOrderRepo.js`, add method:
   ```js
   async findActiveByLineAndBoard(lineId, boardId, excludeId) {
     return supabase.from('work_orders')
       .select('id, wo_number')
       .eq('line_id', lineId)
       .eq('board_id', boardId)
       .eq('status', 'active')
       .neq('id', excludeId)
       .single();
   }
   ```
2. In start API route, before status update:
   - Fetch current WO's `line_id` and `board_id`
   - Query for existing active WO on same line+board
   - If found, return 409 with message: "Cannot start WO. WO-XXXX is still active for this model. Please hold or complete it first."
3. In page.jsx, handle 409 error and show toast with specific message

**Acceptance criteria:**
- Starting WO when another active WO exists for same line+board shows error
- Error message includes the active WO number
- User can hold the active WO then start the new one

---

### #7 - Auto-Update Toggle in System Update

**Problem:** System update page only has manual "Check Now" button. Need auto-update toggle option.

**Files to modify:**
- `app/super-admin/system-update/page.js` — Add toggle UI and periodic check logic
- `hooks/useSystemUpdate.js` — Add auto-check interval support
- Optionally: store preference in localStorage (simplest) or DB setting

**Implementation:**
1. Add toggle switch to System Update page header area:
   - Label: "Auto Check for Updates"
   - Options: Off / Every Hour / Every Day
   - Store preference in localStorage (`indusia_auto_update_interval`)
2. In `useSystemUpdate` hook:
   - Read preference from localStorage
   - If enabled, set up `setInterval` for periodic check
   - Clear interval on unmount or preference change
3. When auto-check finds update, show toast notification (non-intrusive)

**Acceptance criteria:**
- Toggle appears on System Update page
- When enabled, checks for updates at configured interval
- Preference persists across page refreshes
- Auto-check doesn't run if not on the page (optional: could run globally via layout)

---

### #12 - Customer Logo Upload (Base64)

**Problem:** Users want to upload company logos for customers, displayed across Dashboard, WO list, and Live Inspection View.

**Files to modify:**
- `app/engineering/master-data/page.js` — Add logo upload input in customer form
- `app/api/master-data/customers/route.js` — Accept `logo_base64` field in POST/PATCH
- `lib/repos/masterDataRepo.js` — Include `logo_base64` in customer queries
- `migrations/0XX_add_customer_logo.sql` — Add `logo_base64` column
- `components/dashboard/` — Display logo where customer is shown
- `components/work-orders/WorkOrderTable.jsx` — Display logo next to customer name
- `components/inspection/LiveViewV3.jsx` — Display logo in header/info area

**DB Migration:**
```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS logo_base64 TEXT;
-- TEXT type to store base64-encoded image data
-- Expected max ~200KB encoded = ~270KB base64 string
```

**Implementation:**
1. Create migration
2. Customer form — Add file upload input:
   - Accept PNG, JPG, SVG only
   - Max file size: 200KB (check before base64 conversion)
   - Preview thumbnail after upload
   - Convert to base64 on client side using `FileReader.readAsDataURL()`
   - Store in form state, send with POST/PATCH
3. API route — Accept and validate `logo_base64`:
   - Validate base64 format (starts with `data:image/`)
   - Validate size (reject if > 300KB base64 string)
4. Display components — Create `CustomerLogo` component:
   ```jsx
   function CustomerLogo({ customer, size = 'sm' }) {
     if (!customer?.logo_base64) {
       return <InitialsBadge name={customer?.name} size={size} />;
     }
     return <img src={customer.logo_base64} alt={customer.name} className="..." />;
   }
   ```
5. Use `CustomerLogo` in: Dashboard KPI cards, WO table customer column, Live View header

**Acceptance criteria:**
- Can upload logo when creating/editing customer
- Logo preview shows in form after upload
- Logo displays in Dashboard, WO list, and Live Inspection view
- Graceful fallback (initials badge) when no logo
- File size validation (max 200KB)

---

## Tier C: Major Features

### #8 & #9 - Override Review Per-Object + Click-to-Zoom

**Problem:** Override review is currently per-frame. Need per-object approve/reject with image zoom capabilities.

**Current architecture:** `OverrideReviewModal.jsx` (898 lines) iterates frames, shows all objects as display-only list with bounding boxes.

**New paradigm:**
- Only NG objects need review (GOOD objects auto-confirmed)
- Each NG object gets individual approve/reject
- Clicking an object zooms the PCB image to its `[x1, y1, x2, y2]` coordinates
- Image can be enlarged, zoomed in/out, and reset

**Coordinate system:** OpenCV standard — origin at top-left, X→right, Y→down. `[x1, y1, x2, y2]` = top-left to bottom-right of bounding box in pixel coordinates.

**Files to modify:**
- `components/inspection/OverrideReviewModal.jsx` — Major redesign
- `components/inspection/DetectionOverlay.jsx` — Add click handler on bounding boxes
- `app/api/overrides/[id]/route.js` — Accept per-object decisions
- `lib/repos/overridesRepo.js` — Store per-object decisions
- `migrations/0XX_add_object_decisions.sql` — Schema for per-object data

**New component layout:**
```
┌─────────────────────────────────────────────────────┐
│  Review Override — WO-xxx  Operator User  1 PCB     │
├──────────────────────┬──────────────────────────────┤
│                      │  NG OBJECTS (3/7 need review) │
│   PCB Image          │  ┌─────────────────────────┐ │
│   (zoomable,         │  │ ⚠ solder-bridge  95.2%  │ │
│    pannable)         │  │   [APPROVE] [REJECT]    │ │
│                      │  ├─────────────────────────┤ │
│   [🔍+ 🔍- ↺ ⤢]    │  │ ⚠ missing-comp   88.1% │ │
│                      │  │   [APPROVE] [REJECT]    │ │
│                      │  ├─────────────────────────┤ │
│                      │  │ ✓ target-screw  100%    │ │
│                      │  │   (auto-confirmed GOOD) │ │
│                      │  └─────────────────────────┘ │
├──────────────────────┴──────────────────────────────┤
│  [Submit Review]  3/3 NG objects reviewed            │
└─────────────────────────────────────────────────────┘
```

**Image zoom implementation:**
- Use CSS `transform: scale() translate()` on image container
- On object click: calculate center of `[x1,y1,x2,y2]`, translate to center + scale 2-3x
- Zoom controls: +, -, reset, fullscreen
- Mouse wheel zoom support
- Pan via drag when zoomed in

**DB Schema for per-object decisions:**
```sql
CREATE TABLE IF NOT EXISTS override_object_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  override_id UUID REFERENCES overrides(id) ON DELETE CASCADE,
  frame_side TEXT NOT NULL,          -- 'TOP' or 'BOTTOM'
  frame_index INTEGER NOT NULL,
  object_index INTEGER NOT NULL,
  object_name TEXT NOT NULL,         -- e.g., 'solder_bridge'
  object_score DECIMAL(5,4),         -- confidence score
  bbox_x1 INTEGER, bbox_y1 INTEGER,
  bbox_x2 INTEGER, bbox_y2 INTEGER,
  decision TEXT NOT NULL,            -- 'approved' (false call) or 'rejected' (real NG)
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT                        -- Optional reason for decision
);
```

**Implementation steps:**
1. Create migration for `override_object_decisions` table
2. Build `ImageViewer` component with zoom/pan capabilities
3. Redesign `OverrideReviewModal`:
   - Left: `ImageViewer` with zoomable PCB image + bounding box overlay
   - Right: Object list panel
   - Filter: Show NG objects needing review at top, GOOD objects collapsed below
   - Click object → `ImageViewer` zooms to bbox center
4. Update API to accept per-object decisions array
5. Update repo to insert into `override_object_decisions`

**Acceptance criteria:**
- Each NG object has individual approve/reject buttons
- GOOD objects auto-confirmed (shown as read-only)
- Click object → image zooms to object's bounding box
- Zoom in/out/reset controls work
- Image can be enlarged to near-fullscreen
- All object decisions submitted together
- Keyboard shortcuts (A=approve, R=reject, arrow keys=navigate objects)

---

### #10 - Override Appeal Mechanism

**Problem:** After manager approves/rejects, need ability to appeal for re-review. Manager role only, 1 appeal per override per object.

**Files to modify:**
- `app/api/overrides/[id]/appeal/route.js` — New API endpoint
- `lib/repos/overridesRepo.js` — Add appeal methods
- `components/inspection/OverrideReviewModal.jsx` — Add appeal button for reviewed objects
- `components/inspection/` — Override list shows appeal status
- `migrations/0XX_add_appeal_fields.sql` — Schema changes
- Cloud sync: `lib/sync/syncToCloud.js` — Handle re-sync of appealed overrides

**Status flow:**
```
pending → approved/rejected → appealed → re_approved/re_rejected
                                ↑
                          (manager only, 1x, with reason)
```

**DB Schema changes:**
```sql
-- Add to override_object_decisions
ALTER TABLE override_object_decisions
  ADD COLUMN IF NOT EXISTS appeal_status TEXT,        -- 'appealed', 're_approved', 're_rejected'
  ADD COLUMN IF NOT EXISTS appeal_reason TEXT,
  ADD COLUMN IF NOT EXISTS appealed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS appealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appeal_decided_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS appeal_decided_at TIMESTAMPTZ;

-- Track cloud sync status for appeals
ALTER TABLE overrides
  ADD COLUMN IF NOT EXISTS appeal_sync_status TEXT DEFAULT 'none';
  -- Values: 'none', 'pending', 'synced'
```

**Implementation steps:**
1. Create migration
2. Add appeal button in OverrideReviewModal for already-decided objects:
   - Button visible only after initial review is complete
   - Only for manager role
   - Requires reason text input
   - Shows "1x Appeal" indicator (disabled after used)
3. Create API endpoint `POST /api/overrides/:id/appeal`:
   - Validate: user is manager, appeal not already used for this object
   - Update object decision: set `appeal_status = 'appealed'`
   - Record `appeal_reason`, `appealed_by`, `appealed_at`
   - Set `overrides.appeal_sync_status = 'pending'`
4. Re-review flow: appealed objects appear back in review queue
5. Cloud sync: include appealed overrides in sync cycle
   - `syncToCloud.js` checks `appeal_sync_status = 'pending'`
   - After sync, set `appeal_sync_status = 'synced'`

**Acceptance criteria:**
- Manager can appeal a reviewed object (1x per object)
- Appeal requires reason text
- Appealed objects return to review queue
- Appeal history tracked (who, when, reason)
- Appealed overrides re-synced to cloud
- Cannot appeal same object twice

---

### #11 - Live Inspection Per-Object Review + Zoom

**Problem:** Live inspection currently reviews per-frame. Need per-object review with object list panel and click-to-zoom.

**Current architecture:** `CavityReviewOverlay.jsx` and inline review in `LiveViewV3.jsx` iterate NG frames, operator confirms GOOD/NG per frame.

**New paradigm:**
- Show all detected objects in a list panel beside PCB image
- Only NG objects need confirmation (GOOD auto-confirmed)
- Click object → PCB zooms to `[x1, y1, x2, y2]` coordinates
- Same `ImageViewer` component from #8/#9

**Files to modify:**
- `components/inspection/LiveViewV3.jsx` — Add object list panel, change review flow
- `components/inspection/CavityReviewOverlay.jsx` — Redesign for per-object review
- `components/inspection/SidePanel.jsx` — Show objects with clickable interaction
- `lib/utils/inspectionReview.js` — Update `computePcbCounts` for per-object decisions
- Reuse `ImageViewer` component from #8/#9

**New layout for CavityReviewOverlay:**
```
┌─────────────────────────────────────────────────────┐
│  AI: NG   NG Frame 1/3   TOP                  🔍 ✕  │
├──────────────────────┬──────────────────────────────┤
│                      │  DETECTED OBJECTS — TOP F1    │
│   PCB Image          │  ┌─────────────────────────┐ │
│   (zoomable)         │  │ ⚠ solder-bridge  95.2%  │ │
│                      │  │   [GOOD (G)] [NG (N)]   │ │
│                      │  ├─────────────────────────┤ │
│                      │  │ ✓ target-screw  100%    │ │
│                      │  │   (GOOD - auto)         │ │
│                      │  └─────────────────────────┘ │
│   [🔍+ 🔍- ↺]       │                              │
├──────────────────────┴──────────────────────────────┤
│  ◄ ▪▪▪ ►   2/3 NG objects reviewed                  │
│  [Submit when all reviewed]                          │
└─────────────────────────────────────────────────────┘
```

**Decision flow change:**
```
OLD: Frame has 7 objects → Operator says "GOOD" or "NG" for entire frame
NEW: Frame has 7 objects (3 NG) → Operator reviews each NG object individually
     → If ALL NG objects confirmed as GOOD (false call) → frame = GOOD
     → If ANY NG object confirmed as real NG → frame = NG
```

**Implementation steps:**
1. Reuse `ImageViewer` component from #8/#9
2. Redesign `CavityReviewOverlay`:
   - Replace full-frame GOOD/NG buttons with per-object decision panel
   - Object list shows NG objects first (need review), then GOOD objects (auto-confirmed)
   - Click object → zoom to bbox
   - Keyboard: A=approve (false call), N=confirm NG, arrow up/down=navigate objects
3. Update `LiveViewV3` inline review:
   - Same per-object paradigm
   - `ngFrameReview.decisions` changes from `{ 'TOP-0': 'reason' }` to `{ 'TOP-0-obj0': 'reason', 'TOP-0-obj1': 'REAL_NG' }`
4. Update `inspectionReview.js`:
   - `computePcbCounts` now considers per-object decisions
   - Frame verdict derived from object verdicts
5. Update `submitDecision` in LiveViewV3:
   - Include per-object decision data in override creation
   - Store in `ng_frame_details` JSON or separate field

**Acceptance criteria:**
- Object list shows beside PCB image during NG review
- Only NG objects require confirmation
- Click object → image zooms to bounding box
- Frame verdict derived from individual object decisions
- Keyboard shortcuts work (A, N, arrow keys)
- Counter updates correctly based on per-object decisions
- Shared `ImageViewer` component with Override Review (#8/#9)

---

## Implementation Order

### Phase 1: Tier A (Quick Fixes)
1. #4 — Tab rename (5 min)
2. #5 — Loading animation (5 min)
3. #2 — Dropdown refresh investigation + fix (30 min)

### Phase 2: Tier B (Medium)
4. #1 — Force complete WO (migration + API + UI)
5. #3 — Block active WO start (API validation + error handling)
6. #12 — Customer logo upload (migration + upload + display)
7. #7 — Auto-update toggle (localStorage + interval)

### Phase 3: Tier C - Shared Foundation
8. Build `ImageViewer` component (zoom, pan, bbox click-to-zoom)
9. Create `override_object_decisions` migration

### Phase 4: Tier C - Override Review (#8, #9, #10)
10. Redesign `OverrideReviewModal` for per-object review
11. Implement click-to-zoom on objects
12. Add appeal mechanism

### Phase 5: Tier C - Live Inspection (#11)
13. Redesign `CavityReviewOverlay` for per-object review
14. Update `LiveViewV3` inline review
15. Update `inspectionReview.js` computations

### Phase 6: Testing & Polish
16. E2E testing of all flows
17. i18n for all new strings
18. Verify cloud sync with per-object data

---

## Data Integration Map

| Component | Data Source | Existing? | Notes |
|-----------|-----------|-----------|-------|
| Customer logo | `customers.logo_base64` | No | New column via migration |
| WO completion reason | `work_orders.completion_reason` | No | New column via migration |
| WO completed_by | `work_orders.completed_by` | No | New column via migration |
| Object decisions | `override_object_decisions` | No | New table via migration |
| Appeal data | `override_object_decisions.appeal_*` | No | New columns via migration |
| Auto-update pref | localStorage | No | `indusia_auto_update_interval` |
| Detected objects | SSE `frame.objects[]` | Yes | Already received via SSE |
| Bounding boxes | `objects[].box = [x1,y1,x2,y2]` | Yes | OpenCV coords, pixel space |
| Master data refresh | `useMasterData().refreshMasterData()` | Yes | Already exists, may need cache fix |
| Role loading state | `useRoles().loading` | Yes | Exists but not used in component |

---

## Test Data: PCB-3 Model

**Model:** EV10-035790-0000 (PCB-3)
**Images:** `public/images/PCB-3/pcb-3-top.png` (~15MB), `public/images/PCB-3/pcb-3-bottom.png` (~15MB)
**Usage:** These high-res images appear in Live View when inspecting PCB-3 model. Use as primary test case for Tier C per-object review + zoom features.

---

## Migrations Required

```
migrations/0XX_add_wo_completion_fields.sql
migrations/0XX_add_customer_logo.sql
migrations/0XX_create_override_object_decisions.sql
migrations/0XX_add_appeal_fields.sql
```

**Note:** Migration numbers will be determined at implementation time based on existing highest migration number.

> **For Claude:** REQUIRED SKILL: Use gaspol-execute to implement this plan.
> **CRITICAL:** This plan specifies real integrations. During execution,
> NEVER substitute placeholders for real data sources without explicit
> user approval. If a data source doesn't exist yet, STOP and ask.

## Goal

Redesign the Override Review Modal so managers review each NG frame individually (approve/reject per frame) using CavityReview-style navigation, instead of the current single approve/reject for the entire override. This gives granular training data — approved frames confirm false calls, rejected frames confirm real defects.

## Architecture Context

**From CLAUDE.md:**
- Override records in `overrides` table, one record per submission
- `ng_frame_details` JSON stores per-frame data (side, frameIndex, serialNumber, images, objects, falseCallReason)
- `OverrideReviewModal` (`components/inspection/OverrideReviewModal.jsx`) currently groups frames by SN, single approve/reject
- `CavityReviewOverlay` (`components/inspection/CavityReviewOverlay.jsx`) is the UX pattern to follow: per-frame buttons, auto-advance, keyboard shortcuts, progress tracking
- PATCH `/api/overrides/:id` handles approve/reject via `overridesRepo.approve()`/`.reject()`
- `useOverrides` hook manages client-side state + localStorage cache
- Zod schemas in `lib/validations/schemas.js` for input validation
- Design system: Phosphor/Terminal theme, `phosphor-green` for approve, `phosphor-red` for reject

**Key Pattern Differences (CavityReview vs Override Review):**
- CavityReview: GOOD (false call, needs reason) / NG (real defect) — operator perspective
- Override Review: Approve (agree with operator's false call) / Reject (disagree, defect is real) — manager perspective
- No false call reason needed in override review — operator already provided it

## Tech Stack

- React (Next.js 13.5 App Router), client components
- Supabase JS client via PostgREST (local port 3001)
- Zod for API validation
- Tailwind CSS with Phosphor design tokens
- Lucide icons

## Data Integration Map

| Feature | Data Source | Hook/API | Exists? | Action |
|---------|-----------|----------|---------|--------|
| Frame data in modal | `override.ngFrameDetails` JSON | Parsed in OverrideReviewModal | Yes | Reuse existing parse logic |
| Frame images | `/api/storage/false-calls/{path}` | `getFrameImageUrl()` | Yes | Reuse existing |
| Per-frame decisions state | React `useState` in modal | Local state | No | Create `frameDecisions` state |
| Submit all decisions | PATCH `/api/overrides/:id` | `useOverrides.reviewOverride()` | No | Add `action: 'review'` + `reviewOverride()` |
| Save frame_decisions to DB | `overridesRepo.review()` | New repo method | No | Create method, update `frame_decisions` + `status` |
| frame_decisions column | `overrides` table | PostgREST | No | SQL migration to add JSONB column |
| Status badge in list | `override.status` + `override.frameDecisions` | Overrides page | Exists | Adapt to show frame summary |
| Stats counting | `overridesRepo.getStats()` | `/api/overrides/stats` | Exists | Add 'reviewed' to counts |
| Validation schema | `reviewOverrideSchema` in schemas.js | Zod | Exists | Extend with `frame_decisions` field |
| Cross-SN dedup | `dedupedSnGroups` in modal | `useMemo` | Yes | Reuse existing dedup logic |
| Keyboard shortcuts | `window.addEventListener('keydown')` | useEffect | No | Add A=Approve, R=Reject, arrows |
| Auto-advance | `findNextUnreviewedFrame()` pattern | From CavityReviewOverlay | Yes (pattern) | Adapt for override context |

---

## Phase 1: Database Migration

**Estimated time:** 3 minutes

**Files:**
- Create: `migrations/003_add_frame_decisions.sql`

**Steps:**
1. Create migration file that adds `frame_decisions` JSONB column to `overrides` table
2. Update the `status` CHECK constraint to include `'reviewed'` value
3. Run the migration via `npm run migrate`
4. Verify column exists by querying PostgREST

**Migration SQL:**
```sql
-- Add frame_decisions column for per-frame manager review decisions
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS frame_decisions JSONB;

-- Update status CHECK to allow 'reviewed' status
-- Drop existing constraint if any, then add new one
ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_status_check;
ALTER TABLE overrides ADD CONSTRAINT overrides_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed'));
```

**Verification:**
- [ ] Migration runs without errors
- [ ] `frame_decisions` column exists on `overrides` table
- [ ] Can insert a row with `status = 'reviewed'`
- [ ] Existing `pending`/`approved`/`rejected` values still work

---

## Phase 2: Backend — Repo + API + Schema

**Estimated time:** 8 minutes

**Files:**
- Modify: `lib/repos/overridesRepo.js` — add `review()` method
- Modify: `app/api/overrides/[id]/route.js` — handle `action: 'review'`
- Modify: `lib/validations/schemas.js` — extend `reviewOverrideSchema`

**Steps:**

### 2a. Add `review()` to overridesRepo
1. Add `review(id, reviewerId, reviewerName, frameDecisions, notes)` method
2. It updates: `frame_decisions`, `reviewed_by`, `reviewer_name`, `review_notes`, `reviewed_at`, `status='reviewed'`, `sync_status='pending'`
3. Pattern: same as existing `approve()`/`reject()` methods

### 2b. Extend PATCH API route
1. In `handlePATCH`, add `'review'` to the allowed actions array
2. When `action === 'review'`, validate `body.frameDecisions` is a non-empty object
3. Call `overridesRepo.review(id, reviewerId, reviewerName, body.frameDecisions, body.reviewNotes)`

### 2c. Update Zod schema
1. Extend `reviewOverrideSchema` to accept `action: 'approve' | 'reject' | 'review'`
2. Add `frame_decisions` field: `z.record(z.string(), z.enum(['approved', 'rejected'])).optional()`
3. Add refinement: if `action === 'review'`, `frame_decisions` is required

### 2d. Update getStats
1. In `overridesRepo.getStats()`, add `reviewed: 0` to the initial accumulator
2. Count overrides with `status === 'reviewed'`

**Verification:**
- [ ] `overridesRepo.review()` successfully updates a test override
- [ ] PATCH with `action: 'review'` returns success
- [ ] PATCH with `action: 'review'` but no `frameDecisions` returns 400
- [ ] Stats endpoint counts `reviewed` status
- [ ] Existing `approve`/`reject` actions still work unchanged

---

## Phase 3: Hook — Add `reviewOverride()` to useOverrides

**Estimated time:** 5 minutes

**Files:**
- Modify: `hooks/useOverrides.js` — add `reviewOverride()` method

**Steps:**
1. Add `reviewOverride(id, reviewerId, reviewerName, frameDecisions, notes)` method
2. Pattern: same as existing `approveOverride()`/`rejectOverride()`
3. Sends PATCH with `{ action: 'review', reviewerId, reviewerName, frameDecisions, reviewNotes: notes }`
4. On success: update local state (set override status to 'reviewed', merge frameDecisions)
5. Refresh stats
6. Export from hook return

**Verification:**
- [ ] `reviewOverride()` is available from `useOverrides()` hook
- [ ] Calling it sends correct PATCH payload
- [ ] Local state updates correctly after successful review
- [ ] Cache is updated

---

## Phase 4: Overrides List Page — Frame Status Summary

**Estimated time:** 5 minutes

**Files:**
- Modify: `app/inspection/overrides/page.js` — adapt status display and handlers

**Steps:**

### 4a. Add 'reviewed' to status filters and counts
1. Add `'reviewed'` to the status filter buttons array
2. Add `reviewed` to `statusCounts` object
3. Add translation key or fallback label for 'reviewed'

### 4b. Replace StatusBadge with frame summary for reviewed overrides
1. When `override.status === 'reviewed'` and `override.frameDecisions` exists:
   - Count approved/rejected frames from `frameDecisions`
   - Show compact summary: e.g., green count + red count (like `✓2 ✗1`)
2. For `pending`/`approved`/`rejected` (legacy), keep existing StatusBadge

### 4c. Wire up `reviewOverride` handler
1. Add `handleReview` handler that calls `reviewOverride()` from hook
2. Pass as new prop to OverrideReviewModal: `onReview`
3. Keep `onApprove`/`onReject` for legacy single-frame overrides

**Verification:**
- [ ] 'Reviewed' filter tab appears and works
- [ ] Reviewed overrides show frame status summary (e.g., "2 approved / 1 rejected")
- [ ] Legacy overrides still show Approved/Rejected badges
- [ ] Review button opens modal; View button for already-reviewed overrides

---

## Phase 5: OverrideReviewModal Redesign — Per-Frame Review UX

**Estimated time:** 15 minutes (largest phase)

**Files:**
- Modify: `components/inspection/OverrideReviewModal.jsx` — major UX rewrite

**Steps:**

### 5a. Add per-frame decision state
1. Add `frameDecisions` state: `useState({})` — keys like `"TOP-0"`, values `"approved"`/`"rejected"`
2. Add `reviewerNotes` state (already exists)
3. Compute `reviewedCount`, `totalFrameCount`, `allReviewed` from state
4. Reset state when `override` prop changes

### 5b. Replace body with CavityReview-style layout
1. Remove SN tab grouping — show flat list of ALL frames across all SNs
2. Show one frame at a time with large image display
3. Frame metadata below image (Side, Frame, SN, Position, Reason)
4. Detected objects list (reuse existing dedup logic)
5. AI/RAW image toggle (reuse existing toggle)

### 5c. Add per-frame Approve/Reject buttons
1. In footer area, show Approve (green) and Reject (red) buttons for current frame
2. On click: save decision to `frameDecisions` state, auto-advance to next unreviewed
3. Already-reviewed frame: show decision badge + navigation buttons
4. Pattern from CavityReview: `advanceOrComplete` logic

### 5d. Add frame thumbnail strip
1. Below the main image, show horizontal scrollable strip of frame thumbnails
2. Each thumbnail shows:
   - Frame image (small)
   - Side label (TOP/BOTTOM)
   - Decision badge: green checkmark (approved), red X (rejected), or neutral (pending)
3. Click thumbnail to navigate to that frame

### 5e. Add progress indicator in header
1. Show "Frame X/Y" counter
2. Show "Z/Y reviewed" progress
3. Show frame's SN in header

### 5f. Auto-submit when all frames reviewed
1. `useEffect` watches `frameDecisions` — when `reviewedCount === totalFrameCount`:
   - 800ms delay (show last badge)
   - Show reviewer notes input + Submit button
   - OR auto-call `onReview(override.id, frameDecisions, reviewerNotes)`
2. Actually: after all frames decided, show a **summary view** with notes input + final Submit button
   - This gives manager a chance to add notes before submission
   - Summary shows: frame count, approved count, rejected count

### 5g. Add keyboard shortcuts
1. `A` key = Approve current frame
2. `R` key = Reject current frame
3. Arrow Left/Right = navigate frames
4. Escape = close modal
5. Only active when frame is not yet reviewed and modal is open

### 5h. Read-only mode for already-reviewed overrides
1. When `override.status === 'reviewed'` and `override.frameDecisions`:
   - Load decisions into state (read-only)
   - Show decision badges on all frames
   - No approve/reject buttons
   - Show reviewer notes (read-only)
   - Close button only in footer

**Verification:**
- [ ] Modal opens and shows first frame with Approve/Reject buttons
- [ ] Clicking Approve/Reject saves decision and advances to next frame
- [ ] Frame thumbnail strip shows correct decision badges (green/red/neutral)
- [ ] Progress indicator updates correctly
- [ ] After all frames reviewed, summary + notes input + Submit button appears
- [ ] Submit sends PATCH with all frame decisions
- [ ] Keyboard shortcuts A/R/arrows/Esc work correctly
- [ ] Already-reviewed overrides show in read-only mode
- [ ] Legacy single-frame overrides still work with old approve/reject flow
- [ ] AI/RAW image toggle works per frame
- [ ] Modal resets state when switching between overrides

---

## Phase 6: Integration Testing & Polish

**Estimated time:** 5 minutes

**Files:**
- All modified files from previous phases

**Steps:**
1. Test full flow: open pending override → review each frame → submit → verify DB
2. Test mixed decisions: approve some frames, reject others
3. Test re-opening reviewed override in read-only mode
4. Test legacy single-frame override still works (backward compatibility)
5. Test stats counting: pending, reviewed, approved, rejected
6. Test overrides list page: frame summary display, filter by 'reviewed'
7. Test keyboard shortcuts: A, R, arrows, Escape
8. Verify cloud sync still works with new 'reviewed' status

**Verification:**
- [ ] Full review flow works end-to-end
- [ ] Mixed approve/reject decisions per frame work
- [ ] Read-only view for reviewed overrides works
- [ ] Legacy overrides backward compatible
- [ ] Stats accurate across all statuses
- [ ] List page shows frame summary for reviewed overrides
- [ ] No console errors
- [ ] Modal responsive on different screen sizes

---

## Execution Order

Phases are **sequential** (each depends on the previous):
1. Phase 1 (DB) → Phase 2 (API) → Phase 3 (Hook) → Phase 4 (List page) → Phase 5 (Modal) → Phase 6 (Testing)

No parallelization possible since the modal (Phase 5) needs the hook (Phase 3) which needs the API (Phase 2) which needs the DB (Phase 1).

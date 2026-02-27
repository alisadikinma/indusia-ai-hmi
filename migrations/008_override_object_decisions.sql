-- Migration: Per-object override decisions + appeal mechanism
-- Changes review paradigm from per-frame to per-object.
-- Each detected object in an override gets its own approve/reject decision.
-- Reviewed objects can be appealed once (with reason + user tracking).

-- 1. Create override_object_decisions table
CREATE TABLE IF NOT EXISTS override_object_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  override_id TEXT NOT NULL REFERENCES overrides(id) ON DELETE CASCADE,

  -- Object location within the override
  frame_side TEXT NOT NULL,           -- 'TOP' or 'BOTTOM'
  frame_index INTEGER NOT NULL,       -- frame index within the side
  object_index INTEGER NOT NULL,      -- object index within the frame

  -- Object detection info (snapshot from AI)
  object_name TEXT NOT NULL,          -- e.g. 'solder_bridge', 'missing_component'
  object_score DECIMAL(5,4),          -- confidence 0.0000-1.0000
  bbox_x1 INTEGER,
  bbox_y1 INTEGER,
  bbox_x2 INTEGER,
  bbox_y2 INTEGER,

  -- Manager review decision
  decision TEXT CHECK (decision IN ('approved', 'rejected')),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  reason TEXT,

  -- Appeal fields (1x per object, after initial review)
  appeal_status TEXT CHECK (appeal_status IN ('appealed', 're_approved', 're_rejected')),
  appeal_reason TEXT,
  appealed_by TEXT,
  appealed_at TIMESTAMPTZ,
  appeal_decided_by TEXT,
  appeal_decided_at TIMESTAMPTZ,
  appeal_decision_reason TEXT,

  -- Sync tracking
  sync_status TEXT DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one decision per object per override
  UNIQUE (override_id, frame_side, frame_index, object_index)
);

-- 2. Index for fast lookups by override
CREATE INDEX IF NOT EXISTS idx_override_obj_decisions_override_id
  ON override_object_decisions(override_id);

-- 3. Index for pending appeals (manager queue)
CREATE INDEX IF NOT EXISTS idx_override_obj_decisions_appeal_status
  ON override_object_decisions(appeal_status)
  WHERE appeal_status = 'appealed';

-- 4. Add appeal_decisions JSONB column to overrides table
-- Stores per-object appeal data: { "TOP-0-OBJ-1": { status, reason, appealedBy, ... } }
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS appeal_decisions JSONB;

-- 5. Update overrides status CHECK to support new statuses
-- 'reviewed' = has per-object decisions (mix of approved/rejected)
-- 'appealed' = at least one object has been appealed
ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_status_check;
ALTER TABLE overrides ADD CONSTRAINT overrides_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed', 'appealed'));

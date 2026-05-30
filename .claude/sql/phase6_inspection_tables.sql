-- =============================================
-- Phase 6: Inspection Tables Migration
-- Records operator inspection decisions and sessions
-- =============================================

-- =============================================
-- Table: inspection_sessions
-- Tracks operator inspection sessions
-- =============================================
CREATE TABLE IF NOT EXISTS inspection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  operator_id UUID REFERENCES users(id) NOT NULL,
  line_id UUID REFERENCES lines(id) NOT NULL,
  board_id UUID REFERENCES boards(id),

  -- Session info
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed', 'abandoned'

  -- Stats
  total_inspected INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_false_calls INTEGER DEFAULT 0,
  total_auto_approved INTEGER DEFAULT 0,

  -- Timing
  total_pause_time_ms INTEGER DEFAULT 0,
  avg_decision_time_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_sessions_operator ON inspection_sessions(operator_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_line ON inspection_sessions(line_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_status ON inspection_sessions(status);

-- =============================================
-- Table: inspection_results
-- Records each operator decision
-- =============================================
CREATE TABLE IF NOT EXISTS inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session reference
  session_id UUID REFERENCES inspection_sessions(id),

  -- Context
  board_id UUID REFERENCES boards(id),
  line_id UUID REFERENCES lines(id),
  section_id UUID REFERENCES sections(id),
  customer_id UUID REFERENCES customers(id),

  -- Frame reference
  frame_id UUID REFERENCES inspection_frames(id),
  image_url TEXT,

  -- AI Detection
  ai_result VARCHAR(20), -- 'pass', 'fail', 'review'
  ai_confidence DECIMAL(5,4),
  ai_defect_type VARCHAR(100),
  ai_detections JSONB, -- Full detection array

  -- Operator Decision
  operator_action VARCHAR(20) NOT NULL, -- 'approve', 'reject', 'false_call', 'auto_approve'
  operator_id UUID REFERENCES users(id),
  operator_notes TEXT,

  -- Timing
  decision_time_ms INTEGER, -- Time from display to decision
  auto_approved BOOLEAN DEFAULT FALSE,

  -- Override reference (if false_call)
  override_id UUID REFERENCES overrides(id),

  -- Timestamps
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inspection_results_session ON inspection_results(session_id, inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_results_line ON inspection_results(line_id, inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_results_board ON inspection_results(board_id, inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_results_operator ON inspection_results(operator_id, inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_results_action ON inspection_results(operator_action, inspected_at DESC);

-- =============================================
-- Function: Update session stats on result insert
-- =============================================
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
DECLARE
  current_avg INTEGER;
  current_total INTEGER;
BEGIN
  -- Get current values
  SELECT avg_decision_time_ms, total_inspected
  INTO current_avg, current_total
  FROM inspection_sessions
  WHERE id = NEW.session_id;

  -- Calculate new average decision time
  IF NEW.decision_time_ms IS NOT NULL THEN
    IF current_avg IS NULL OR current_total = 0 THEN
      current_avg := NEW.decision_time_ms;
    ELSE
      current_avg := ((current_avg * current_total) + NEW.decision_time_ms) / (current_total + 1);
    END IF;
  END IF;

  UPDATE inspection_sessions
  SET
    total_inspected = total_inspected + 1,
    total_approved = total_approved + CASE WHEN NEW.operator_action = 'approve' THEN 1 ELSE 0 END,
    total_rejected = total_rejected + CASE WHEN NEW.operator_action = 'reject' THEN 1 ELSE 0 END,
    total_false_calls = total_false_calls + CASE WHEN NEW.operator_action = 'false_call' THEN 1 ELSE 0 END,
    total_auto_approved = total_auto_approved + CASE WHEN NEW.auto_approved THEN 1 ELSE 0 END,
    avg_decision_time_ms = current_avg,
    updated_at = NOW()
  WHERE id = NEW.session_id AND status = 'active';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_session_stats ON inspection_results;
CREATE TRIGGER trg_update_session_stats
AFTER INSERT ON inspection_results
FOR EACH ROW
WHEN (NEW.session_id IS NOT NULL)
EXECUTE FUNCTION update_session_stats();

-- =============================================
-- RLS Policies (if using Supabase RLS)
-- =============================================
-- ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view their own sessions"
--   ON inspection_sessions FOR SELECT
--   USING (operator_id = auth.uid() OR
--          EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'engineer', 'superadmin')));

-- CREATE POLICY "Operators can create sessions"
--   ON inspection_sessions FOR INSERT
--   WITH CHECK (operator_id = auth.uid());

-- CREATE POLICY "Operators can update their own sessions"
--   ON inspection_sessions FOR UPDATE
--   USING (operator_id = auth.uid());

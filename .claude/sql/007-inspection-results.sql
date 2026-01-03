-- ============================================================
-- INSPECTION RESULTS SCHEMA
-- For AOI PCB Solder Inspection History & Management Review
-- ============================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DEFECT CLASSES (Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS defect_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,        -- e.g., 'SOLDER_BRIDGE', 'MISSING_COMP'
  name VARCHAR(100) NOT NULL,              -- e.g., 'Solder Bridge'
  category VARCHAR(50) NOT NULL,           -- 'solder', 'component', 'damage'
  severity VARCHAR(20) NOT NULL DEFAULT 'major', -- 'critical', 'major', 'minor'
  ipc_reference VARCHAR(50),               -- IPC-A-610 section reference
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. FALSE CALL REASONS (Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS false_call_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INSPECTION RESULTS (Main Table)
-- NOTE: Master data tables (boards, lines, sections, customers) use TEXT for id
-- ============================================================
CREATE TABLE IF NOT EXISTS inspection_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Board identification
  board_id VARCHAR(50) NOT NULL,           -- PCB serial/barcode
  batch_id VARCHAR(50),                    -- Production batch
  board_type_id TEXT,                      -- Link to boards.id (optional, no FK for flexibility)
  
  -- Line/Station info (TEXT to match master data tables)
  line_id TEXT,                            -- Link to lines.id
  section_id TEXT,                         -- Link to sections.id
  customer_id TEXT,                        -- Link to customers.id
  
  -- Timestamps
  inspection_timestamp TIMESTAMPTZ DEFAULT NOW(),
  decision_timestamp TIMESTAMPTZ,
  
  -- AI Result
  ai_result VARCHAR(20) NOT NULL,          -- 'PASS', 'FAIL', 'REVIEW'
  ai_confidence DECIMAL(5,4),              -- Overall confidence 0.0000-1.0000
  ai_model_version VARCHAR(50),            -- Model version used
  
  -- Operator Decision
  operator_decision VARCHAR(20),           -- 'APPROVE', 'REJECT', 'FALSE_CALL', NULL (pending)
  operator_id TEXT,                        -- Link to users.id
  
  -- PLC Signals
  plc_signal_sent VARCHAR(20),             -- 'GOOD', 'NG', 'NEXT'
  plc_signal_timestamp TIMESTAMPTZ,
  
  -- Timing
  cycle_time_ms INTEGER,                   -- Time from detection to decision
  
  -- Image Storage (Supabase Storage paths)
  image_full_path TEXT,                    -- Full resolution image
  image_thumbnail_path TEXT,               -- Thumbnail for list view
  image_defect_crop_path TEXT,             -- Cropped defect region
  
  -- Metadata
  shift VARCHAR(20),                       -- 'day', 'night', 'swing'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. INSPECTION DEFECTS (One-to-Many with inspection_results)
-- ============================================================
CREATE TABLE IF NOT EXISTS inspection_defects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspection_results(id) ON DELETE CASCADE,
  
  -- Defect classification
  defect_class_id UUID REFERENCES defect_classes(id),
  defect_type VARCHAR(50) NOT NULL,        -- 'solder_bridge', 'missing_component', etc
  defect_code VARCHAR(20),                 -- IPC code if applicable
  severity VARCHAR(20) NOT NULL,           -- 'critical', 'major', 'minor'
  
  -- AI Detection data
  confidence DECIMAL(5,4) NOT NULL,        -- 0.0000-1.0000
  
  -- Location (in pixels, relative to full image)
  bbox_x INTEGER NOT NULL,
  bbox_y INTEGER NOT NULL,
  bbox_width INTEGER NOT NULL,
  bbox_height INTEGER NOT NULL,
  
  -- Component reference
  component_ref VARCHAR(50),               -- e.g., 'U15', 'R23', 'C47'
  pin_number VARCHAR(20),                  -- e.g., 'Pin 3', '1-2'
  
  -- Operator disposition (for this specific defect)
  operator_disposition VARCHAR(20),        -- 'TRUE_DEFECT', 'FALSE_CALL'
  false_call_reason_id UUID REFERENCES false_call_reasons(id),
  false_call_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. INDEXES for Performance
-- NOTE: Removed DATE() index - not IMMUTABLE with TIMESTAMPTZ
-- ============================================================

-- inspection_results indexes
CREATE INDEX IF NOT EXISTS idx_inspection_results_board_id 
  ON inspection_results(board_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_line_id 
  ON inspection_results(line_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_timestamp 
  ON inspection_results(inspection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_results_operator_decision 
  ON inspection_results(operator_decision);
CREATE INDEX IF NOT EXISTS idx_inspection_results_ai_result 
  ON inspection_results(ai_result);

-- inspection_defects indexes
CREATE INDEX IF NOT EXISTS idx_inspection_defects_inspection_id 
  ON inspection_defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_defects_defect_type 
  ON inspection_defects(defect_type);
CREATE INDEX IF NOT EXISTS idx_inspection_defects_severity 
  ON inspection_defects(severity);

-- ============================================================
-- 6. TRIGGERS for updated_at
-- ============================================================

-- Trigger function (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to inspection_results
DROP TRIGGER IF EXISTS update_inspection_results_updated_at ON inspection_results;
CREATE TRIGGER update_inspection_results_updated_at
  BEFORE UPDATE ON inspection_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to defect_classes
DROP TRIGGER IF EXISTS update_defect_classes_updated_at ON defect_classes;
CREATE TRIGGER update_defect_classes_updated_at
  BEFORE UPDATE ON defect_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AI Backend Schema Updates
-- Add columns needed for AI Backend integration
-- Run: 2026-01-07
-- ============================================================

-- 1. Add part_number to boards table
ALTER TABLE boards 
ADD COLUMN IF NOT EXISTS part_number TEXT;

-- Create index for part_number lookups
CREATE INDEX IF NOT EXISTS idx_boards_part_number ON boards (part_number);

-- 2. Add ai_model_id to lines table (model assigned per line)
-- NOTE: ai_models.id is UUID type
ALTER TABLE lines 
ADD COLUMN IF NOT EXISTS ai_model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL;

-- 3. Add camera_config and inspection_params to lines
ALTER TABLE lines 
ADD COLUMN IF NOT EXISTS camera_config JSONB DEFAULT '{}';

ALTER TABLE lines 
ADD COLUMN IF NOT EXISTS inspection_params JSONB DEFAULT '{
  "confidence_threshold": 0.85,
  "auto_pass_threshold": 0.95
}';

-- Create index for lines with active models
CREATE INDEX IF NOT EXISTS idx_lines_ai_model ON lines (ai_model_id) WHERE ai_model_id IS NOT NULL;

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'boards';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lines';

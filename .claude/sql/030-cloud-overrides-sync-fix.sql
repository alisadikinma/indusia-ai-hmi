-- =============================================
-- CLOUD SCHEMA: Add missing overrides columns
-- Run this on CLOUD Supabase (not local)
-- =============================================

-- Columns added to local after initial schema creation
-- Required for sync to work properly

-- image_url: AI-annotated image URL
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS image_url TEXT;

-- local_image_path: deprecated single path (kept for backwards compatibility)
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS local_image_path TEXT;

-- local_image_paths: JSON string of local file paths (top/bottom arrays)
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS local_image_paths TEXT;

-- cloud_image_paths: JSON string of cloud storage paths after upload
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS cloud_image_paths TEXT;

-- ng_frame_details: JSON string with per-frame false call metadata (serial numbers, defect objects, etc.)
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS ng_frame_details TEXT;

-- line_id: production line reference
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS line_id TEXT;

-- work_order_id: work order reference
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS work_order_id TEXT;

-- updated_at: last update timestamp
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- reviewed_by: reviewer user ID (local uses reviewed_by, original schema had reviewer_id)
-- Add reviewed_by as alias — both columns can coexist
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- review_notes: reviewer notes (local uses review_notes, original schema had reviewer_notes)
-- Both may already exist; safe to run
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Verify final schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'overrides'
ORDER BY ordinal_position;

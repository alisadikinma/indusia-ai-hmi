-- ============================================
-- 009: Supabase Storage Setup for Inspection Images
-- ============================================
-- Run this in Supabase SQL Editor
-- 
-- Creates storage bucket and policies for:
-- - Sample PCB images (for simulation)
-- - Inspection result images (production)
-- - Defect crop images (for ML training)
-- ============================================

-- 1. Create storage bucket for inspection images
-- Note: Run this via Supabase Dashboard > Storage > New Bucket
-- Or use the Supabase client/API

-- Bucket settings:
-- Name: inspection-images
-- Public: false (private bucket)
-- File size limit: 10MB
-- Allowed MIME types: image/png, image/jpeg, image/webp

-- 2. Create folder structure (convention)
-- /samples/          - Sample images for simulation/testing
-- /inspections/      - Production inspection images
--   /{year}/{month}/{day}/{line_id}/
--     overview_{board_id}_{timestamp}.png
--     defect_{defect_id}_{component}.png
--     thumbnail_{board_id}.jpg
-- /training/         - Images queued for ML training
-- /golden/           - Golden reference images per board type

-- 3. Storage policies (RLS)

-- Allow authenticated users to read sample images
CREATE POLICY "Allow authenticated read samples"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'inspection-images' AND (storage.foldername(name))[1] = 'samples');

-- Allow authenticated users to read their line's inspection images
CREATE POLICY "Allow authenticated read inspections"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'inspection-images' AND (storage.foldername(name))[1] = 'inspections');

-- Allow service role to insert inspection images
CREATE POLICY "Allow service insert inspections"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'inspection-images');

-- Allow service role to delete old images (cleanup)
CREATE POLICY "Allow service delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'inspection-images');

-- ============================================
-- Sample Images Metadata Table
-- ============================================

CREATE TABLE IF NOT EXISTS sample_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Image info
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT, -- Public URL or signed URL
  
  -- PCB info
  board_type TEXT, -- e.g., 'PCB-TYPE-A', 'DEMO-BOARD'
  description TEXT,
  
  -- Defect info (for images with defects)
  has_defect BOOLEAN DEFAULT false,
  defect_type TEXT, -- e.g., 'solder_bridge', 'missing_component'
  defect_severity TEXT, -- 'critical', 'major', 'minor'
  defect_bbox JSONB, -- {x, y, width, height}
  defect_component TEXT, -- e.g., 'U15', 'R47'
  
  -- Metadata
  image_width INTEGER,
  image_height INTEGER,
  file_size INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX idx_sample_images_defect_type ON sample_images(defect_type) WHERE has_defect = true;
CREATE INDEX idx_sample_images_board_type ON sample_images(board_type);

-- ============================================
-- Seed sample image metadata (after uploading images)
-- ============================================

-- Example entries (update storage_path after uploading actual images):

-- INSERT INTO sample_images (filename, storage_path, board_type, has_defect, defect_type, defect_severity, defect_bbox, defect_component, image_width, image_height)
-- VALUES 
-- ('pcb_solder_bridge_01.png', 'samples/defects/pcb_solder_bridge_01.png', 'DEMO-BOARD', true, 'solder_bridge', 'critical', '{"x": 280, "y": 180, "width": 80, "height": 60}', 'U15', 640, 480),
-- ('pcb_missing_component_01.png', 'samples/defects/pcb_missing_component_01.png', 'DEMO-BOARD', true, 'missing_component', 'critical', '{"x": 150, "y": 220, "width": 60, "height": 40}', 'C23', 640, 480),
-- ('pcb_tombstone_01.png', 'samples/defects/pcb_tombstone_01.png', 'DEMO-BOARD', true, 'tombstone', 'critical', '{"x": 320, "y": 300, "width": 45, "height": 30}', 'R12', 640, 480),
-- ('pcb_good_01.png', 'samples/good/pcb_good_01.png', 'DEMO-BOARD', false, NULL, NULL, NULL, NULL, 640, 480),
-- ('pcb_good_02.png', 'samples/good/pcb_good_02.png', 'DEMO-BOARD', false, NULL, NULL, NULL, NULL, 640, 480);

-- ============================================
-- Helper function to get random sample image
-- ============================================

CREATE OR REPLACE FUNCTION get_random_sample_defect()
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  defect_type TEXT,
  defect_severity TEXT,
  defect_bbox JSONB,
  defect_component TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.storage_path,
    s.defect_type,
    s.defect_severity,
    s.defect_bbox,
    s.defect_component
  FROM sample_images s
  WHERE s.has_defect = true
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

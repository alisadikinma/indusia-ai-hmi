-- ============================================
-- 010: Seed Sample Images Metadata
-- ============================================
-- Run this AFTER uploading images to Supabase Storage
-- Bucket: inspection-images (PUBLIC)
-- Files are directly in root folder
-- ============================================

-- First, ensure sample_images table exists
CREATE TABLE IF NOT EXISTS sample_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Image info
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  
  -- PCB info
  board_type TEXT,
  description TEXT,
  
  -- Defect info
  has_defect BOOLEAN DEFAULT false,
  defect_type TEXT,
  defect_severity TEXT,
  defect_bbox JSONB,
  defect_component TEXT,
  defect_pin TEXT,
  
  -- Metadata
  image_width INTEGER,
  image_height INTEGER,
  file_size INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sample_images_defect_type ON sample_images(defect_type) WHERE has_defect = true;
CREATE INDEX IF NOT EXISTS idx_sample_images_board_type ON sample_images(board_type);

-- Clear existing demo data
DELETE FROM sample_images WHERE board_type = 'DEMO-BOARD';

-- Insert sample images metadata
-- Path format: filename only (files are in bucket root)

INSERT INTO sample_images (
  filename, 
  storage_path, 
  board_type, 
  description,
  has_defect, 
  defect_type, 
  defect_severity, 
  defect_bbox, 
  defect_component,
  defect_pin,
  image_width, 
  image_height
) VALUES 

-- 1. Solder Bridge (Critical)
(
  'pcb_solder_bridge_01.png',
  'pcb_solder_bridge_01.png',
  'DEMO-BOARD',
  'Solder bridge between adjacent IC pins U15 pin 3-4',
  true,
  'solder_bridge',
  'critical',
  '{"x": 480, "y": 280, "width": 120, "height": 90}',
  'U15',
  'Pin 3-4',
  1280,
  720
),

-- 2. Missing Component (Critical)
(
  'pcb_missing_component_01.png',
  'pcb_missing_component_01.png',
  'DEMO-BOARD',
  'Empty capacitor pad at C23 location',
  true,
  'missing_component',
  'critical',
  '{"x": 320, "y": 250, "width": 100, "height": 70}',
  'C23',
  NULL,
  1280,
  720
),

-- 3. Tombstone (Critical)
(
  'pcb_tombstone_01.png',
  'pcb_tombstone_01.png',
  'DEMO-BOARD',
  'Tombstoned SMD resistor R12 with one end lifted',
  true,
  'tombstone',
  'critical',
  '{"x": 520, "y": 320, "width": 80, "height": 60}',
  'R12',
  NULL,
  1280,
  720
),

-- 4. Insufficient Solder (Major)
(
  'pcb_insufficient_solder_01.png',
  'pcb_insufficient_solder_01.png',
  'DEMO-BOARD',
  'Insufficient solder fillet on resistor R47',
  true,
  'insufficient_solder',
  'major',
  '{"x": 600, "y": 200, "width": 90, "height": 65}',
  'R47',
  'Pin 1',
  1280,
  720
),

-- 5. Cold Solder Joint (Major)
(
  'pcb_cold_solder_01.png',
  'pcb_cold_solder_01.png',
  'DEMO-BOARD',
  'Cold solder joint on IC U8 pin 12, dull grainy appearance',
  true,
  'cold_solder',
  'major',
  '{"x": 400, "y": 280, "width": 100, "height": 80}',
  'U8',
  'Pin 12',
  1280,
  720
),

-- 6. Solder Ball (Minor)
(
  'pcb_solder_ball_01.png',
  'pcb_solder_ball_01.png',
  'DEMO-BOARD',
  'Stray solder balls on PCB surface near component area',
  true,
  'solder_ball',
  'minor',
  '{"x": 550, "y": 350, "width": 70, "height": 70}',
  NULL,
  NULL,
  1280,
  720
),

-- 7. Good Reference (No Defect)
(
  'pcb_good_reference_01.png',
  'pcb_good_reference_01.png',
  'DEMO-BOARD',
  'Good quality PCB with proper solder joints - reference image',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  1280,
  720
);

-- Verify insertion
SELECT 
  filename,
  defect_type,
  defect_severity,
  defect_component,
  has_defect
FROM sample_images 
WHERE board_type = 'DEMO-BOARD'
ORDER BY has_defect DESC, defect_severity;

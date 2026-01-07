-- =============================================
-- FIX OVERRIDES SCHEMA
-- =============================================

-- Add cloud_image_paths if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'overrides' AND column_name = 'cloud_image_paths'
  ) THEN
    ALTER TABLE overrides ADD COLUMN cloud_image_paths TEXT;
    COMMENT ON COLUMN overrides.cloud_image_paths IS 'JSON string for cloud storage paths';
  END IF;
END $$;

-- Add location if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'overrides' AND column_name = 'location'
  ) THEN
    ALTER TABLE overrides ADD COLUMN location VARCHAR(100);
  END IF;
END $$;

-- Add confidence if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'overrides' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE overrides ADD COLUMN confidence DECIMAL(5,2);
  END IF;
END $$;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'overrides' 
ORDER BY ordinal_position;
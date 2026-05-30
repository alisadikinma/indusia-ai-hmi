-- Add metadata column to notifications table
-- Run this in PostgreSQL

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT NULL;
        COMMENT ON COLUMN notifications.metadata IS 'Additional data for notification actions (e.g., overrideId, boardId)';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notifications';

-- Migration 034: Add frame count columns to boards table
-- Models can have different numbers of camera frames per side per PCB.
-- E.g., EV10-035790-0000 has 4 TOP frames + 2 BOTTOM frames for 2 cavities.
-- These counts are needed by computePcbCounts() to correctly group frames into PCBs
-- when serial_number is not available in the SSE inspection data.

ALTER TABLE boards ADD COLUMN IF NOT EXISTS top_frame_count INTEGER DEFAULT 1 CHECK (top_frame_count >= 1);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS bottom_frame_count INTEGER DEFAULT 0 CHECK (bottom_frame_count >= 0);

COMMENT ON COLUMN boards.top_frame_count IS 'Total number of camera frames captured on the TOP side per panel. E.g., 4 means 4 top-side images per inspection cycle.';
COMMENT ON COLUMN boards.bottom_frame_count IS 'Total number of camera frames captured on the BOTTOM side per panel. 0 means top-only inspection (no flip).';

-- Seed existing boards with correct frame counts
UPDATE boards SET top_frame_count = 6, bottom_frame_count = 6 WHERE name = 'EVEQSG00800';
UPDATE boards SET top_frame_count = 6, bottom_frame_count = 6 WHERE name = 'EV10103-000100';
UPDATE boards SET top_frame_count = 4, bottom_frame_count = 2 WHERE name = 'EV10-035790-0000';
UPDATE boards SET top_frame_count = 3, bottom_frame_count = 3 WHERE name = 'EV10-033483-0001';

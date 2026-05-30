-- Migration 029: Add cavity_count to boards table
-- Supports multi-cavity PCB panels where 1 panel has N physical PCBs
-- cavity_count determines how many inspection events to expect per panel cycle

ALTER TABLE boards ADD COLUMN IF NOT EXISTS cavity_count INTEGER DEFAULT 1 CHECK (cavity_count >= 1);

COMMENT ON COLUMN boards.cavity_count IS 'Number of physical PCBs (cavities) per panel. Determines inspection events per cycle and progress counting.';

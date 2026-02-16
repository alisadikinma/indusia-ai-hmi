-- Migration: Add per-frame review decisions to overrides
-- Allows managers to approve/reject individual NG frames instead of entire override

-- Add frame_decisions JSONB column
-- Stores: { "TOP-0": "approved", "BOTTOM-1": "rejected", ... }
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS frame_decisions JSONB;

-- Update status CHECK to allow 'reviewed' status for per-frame reviews
ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_status_check;
ALTER TABLE overrides ADD CONSTRAINT overrides_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed'));

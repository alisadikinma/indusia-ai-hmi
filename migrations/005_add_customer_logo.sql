-- Migration: Add logo_base64 column to customers
-- Stores company logo as base64-encoded image data (PNG/JPG/SVG, max ~200KB)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

-- Migration: Add avatar_base64 column to users table
-- Stores user profile photo as base64 data URI

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_base64 TEXT;

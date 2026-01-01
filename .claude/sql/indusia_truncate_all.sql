-- ============================================================
-- INDUSIA AI - TRUNCATE ALL DATA
-- Run this BEFORE re-seeding data
-- Order: child tables first, then parent tables
-- ============================================================

-- Disable triggers temporarily for faster truncation
SET session_replication_role = 'replica';

-- ============================================================
-- 1. TRUNCATE CHILD TABLES (with foreign keys)
-- ============================================================

-- Training pipeline
TRUNCATE TABLE training_metrics CASCADE;
TRUNCATE TABLE training_jobs CASCADE;
TRUNCATE TABLE dataset_images CASCADE;
TRUNCATE TABLE training_datasets CASCADE;
TRUNCATE TABLE ai_models CASCADE;

-- Inspection & Dashboard
TRUNCATE TABLE inspection_frames CASCADE;
TRUNCATE TABLE inspection_stats CASCADE;
TRUNCATE TABLE dataset_queue CASCADE;

-- Overrides & Images
TRUNCATE TABLE override_images CASCADE;
TRUNCATE TABLE override_embeddings CASCADE;
TRUNCATE TABLE overrides CASCADE;

-- Knowledge Base
TRUNCATE TABLE kb_embeddings CASCADE;
TRUNCATE TABLE kb_articles CASCADE;

-- Notifications & Events
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE event_log CASCADE;
TRUNCATE TABLE system_events CASCADE;

-- ============================================================
-- 2. TRUNCATE RBAC & USERS
-- ============================================================
TRUNCATE TABLE role_menu_permissions CASCADE;
TRUNCATE TABLE users CASCADE;

-- ============================================================
-- 3. TRUNCATE MASTER DATA
-- ============================================================
TRUNCATE TABLE shift_config CASCADE;
TRUNCATE TABLE defect_classes CASCADE;
TRUNCATE TABLE boards CASCADE;
TRUNCATE TABLE lines CASCADE;
TRUNCATE TABLE customer_sections CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE sections CASCADE;
TRUNCATE TABLE menu_items CASCADE;
TRUNCATE TABLE roles CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ============================================================
-- TRUNCATE COMPLETE!
-- Now run indusia_seed_data.sql
-- ============================================================

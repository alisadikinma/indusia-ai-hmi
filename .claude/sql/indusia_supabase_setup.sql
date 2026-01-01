-- ============================================================
-- INDUSIA AI DATABASE SETUP - Complete Schema v2
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 0: EXTENSIONS & PREP
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
SET search_path TO public;

-- ============================================================
-- PART 1: MASTER DATA
-- ============================================================

-- 1.1 Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 1.2 Sections
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 1.3 Customer ↔ Section Mapping
CREATE TABLE IF NOT EXISTS customer_sections (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  section_id  TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, section_id)
);

-- 1.4 Lines
CREATE TABLE IF NOT EXISTS lines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  section_id  TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE
);

-- 1.5 Boards
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- PART 2: ROLES, MENU, PERMISSIONS (RBAC)
-- ============================================================

-- 2.1 Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE
);

-- 2.2 Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL
);

-- 2.3 Role → Menu Permissions
CREATE TABLE IF NOT EXISTS role_menu_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  menu_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, menu_id)
);

-- ============================================================
-- PART 3: USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id TEXT NOT NULL REFERENCES roles(id),
  sections TEXT[] NOT NULL DEFAULT '{}',
  password TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  must_change_password BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PART 4: NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  severity TEXT NOT NULL,
  line_id TEXT REFERENCES lines(id),
  section_id TEXT REFERENCES sections(id),
  user_id TEXT REFERENCES users(id),
  source TEXT,
  related_event_id TEXT
);

-- ============================================================
-- PART 5: EVENT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  role_id TEXT REFERENCES roles(id),
  section_id TEXT REFERENCES sections(id),
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log (type);
CREATE INDEX IF NOT EXISTS idx_event_log_source ON event_log (source);
CREATE INDEX IF NOT EXISTS idx_event_log_user ON event_log (user_id);
CREATE INDEX IF NOT EXISTS idx_event_log_section ON event_log (section_id);

-- ============================================================
-- PART 6: SYSTEM HEALTH EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  component TEXT NOT NULL,
  state TEXT NOT NULL,
  message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_events_component ON system_events (component);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events (created_at DESC);

-- ============================================================
-- PART 7: OVERRIDES
-- ============================================================

CREATE TABLE IF NOT EXISTS overrides (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  defect_type TEXT NOT NULL,
  location TEXT,
  confidence NUMERIC,
  reason TEXT,
  operator_notes TEXT,
  operator_id TEXT REFERENCES users(id),
  operator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  reviewer_id TEXT REFERENCES users(id),
  reviewer_name TEXT,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  section_id TEXT REFERENCES sections(id),
  customer_id TEXT REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_overrides_status ON overrides (status);
CREATE INDEX IF NOT EXISTS idx_overrides_created_at ON overrides (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_overrides_section ON overrides (section_id);
CREATE INDEX IF NOT EXISTS idx_overrides_customer ON overrides (customer_id);

-- ============================================================
-- PART 8: OVERRIDE IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS override_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id TEXT NOT NULL REFERENCES overrides(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  is_processed BOOLEAN DEFAULT FALSE,
  training_batch_id UUID,
  uploaded_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_images_override ON override_images(override_id);
CREATE INDEX IF NOT EXISTS idx_override_images_batch ON override_images(training_batch_id) WHERE training_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_override_images_unprocessed ON override_images(is_processed) WHERE is_processed = FALSE;

-- ============================================================
-- PART 9: SEMANTIC SEARCH (Vector 384-dim, HNSW)
-- ============================================================

-- 9.1 Override Embeddings
CREATE TABLE IF NOT EXISTS override_embeddings (
  override_id TEXT PRIMARY KEY REFERENCES overrides(id) ON DELETE CASCADE,
  searchable_text TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS override_embeddings_idx
ON override_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 9.2 Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  role_scope TEXT[],
  language TEXT DEFAULT 'id',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_embeddings (
  article_id UUID PRIMARY KEY REFERENCES kb_articles(id) ON DELETE CASCADE,
  searchable_text TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_embeddings_idx
ON kb_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================
-- PART 10: TRAINING DATASETS
-- ============================================================

CREATE TABLE IF NOT EXISTS training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  image_count INTEGER DEFAULT 0,
  total_annotations INTEGER DEFAULT 0,
  section_id TEXT REFERENCES sections(id),
  customer_id TEXT REFERENCES customers(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_datasets_status ON training_datasets(status);
CREATE INDEX IF NOT EXISTS idx_training_datasets_created ON training_datasets(created_at DESC);

-- ============================================================
-- PART 11: DATASET IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS dataset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES training_datasets(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'override',
  source_id TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  annotations JSONB DEFAULT '[]',
  annotation_count INTEGER DEFAULT 0,
  is_annotated BOOLEAN DEFAULT FALSE,
  annotated_by TEXT REFERENCES users(id),
  annotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_images_dataset ON dataset_images(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_source ON dataset_images(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_unannotated ON dataset_images(dataset_id, is_annotated) WHERE is_annotated = FALSE;

-- ============================================================
-- PART 12: TRAINING JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  dataset_id UUID NOT NULL REFERENCES training_datasets(id),
  status TEXT NOT NULL DEFAULT 'pending',
  modal_call_id TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  base_model TEXT DEFAULT 'yolov10n.pt',
  epochs INTEGER DEFAULT 100,
  batch_size INTEGER DEFAULT 16,
  image_size INTEGER DEFAULT 640,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  model_id UUID,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_dataset ON training_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created ON training_jobs(created_at DESC);

-- ============================================================
-- PART 13: TRAINING METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS training_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES training_jobs(job_id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  train_loss FLOAT,
  val_loss FLOAT,
  box_loss FLOAT,
  cls_loss FLOAT,
  dfl_loss FLOAT,
  precision_val FLOAT,
  recall FLOAT,
  map50 FLOAT,
  map50_95 FLOAT,
  learning_rate FLOAT,
  epoch_time_seconds FLOAT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, epoch)
);

CREATE INDEX IF NOT EXISTS idx_training_metrics_job ON training_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_epoch ON training_metrics(job_id, epoch);

-- ============================================================
-- PART 14: AI MODELS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  training_job_id TEXT REFERENCES training_jobs(job_id),
  dataset_id UUID REFERENCES training_datasets(id),
  storage_path TEXT,
  public_url TEXT,
  file_size INTEGER,
  base_model TEXT,
  framework TEXT DEFAULT 'yolov10',
  map50 FLOAT,
  map50_95 FLOAT,
  precision_val FLOAT,
  recall FLOAT,
  inference_speed_ms FLOAT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_active BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,
  deployed_by TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_models_active ON ai_models(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_models_created ON ai_models(created_at DESC);

-- ============================================================
-- PART 15: RPC FUNCTIONS
-- ============================================================

-- 15.1 match_overrides - Semantic search for overrides
CREATE OR REPLACE FUNCTION match_overrides(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT,
  p_section_id TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  override_id TEXT,
  board_id TEXT,
  defect_type TEXT,
  location TEXT,
  reason TEXT,
  operator_notes TEXT,
  status TEXT,
  section_id TEXT,
  customer_id TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    oe.override_id,
    o.board_id,
    o.defect_type,
    o.location,
    o.reason,
    o.operator_notes,
    o.status,
    o.section_id,
    o.customer_id,
    1 - (oe.embedding <=> query_embedding) AS similarity
  FROM override_embeddings oe
  JOIN overrides o ON o.id = oe.override_id
  WHERE
    (p_section_id IS NULL OR o.section_id = p_section_id)
    AND (p_customer_id IS NULL OR o.customer_id = p_customer_id)
    AND 1 - (oe.embedding <=> query_embedding) >= match_threshold
  ORDER BY oe.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 15.2 match_kb_articles - Semantic search for knowledge base
CREATE OR REPLACE FUNCTION match_kb_articles(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT,
  p_role TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  article_id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  role_scope TEXT[],
  language TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ke.article_id,
    ka.title,
    ka.content,
    ka.category,
    ka.role_scope,
    ka.language,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM kb_embeddings ke
  JOIN kb_articles ka ON ka.id = ke.article_id
  WHERE
    (p_category IS NULL OR ka.category = p_category)
    AND (p_language IS NULL OR ka.language = p_language)
    AND (
      p_role IS NULL
      OR ka.role_scope IS NULL
      OR p_role = ANY(ka.role_scope)
    )
    AND 1 - (ke.embedding <=> query_embedding) >= match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- PART 16: STORAGE BUCKETS
-- Note: Run these separately if they fail (bucket might exist)
-- ============================================================

-- 16.1 inspection-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-images',
  'inspection-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 16.2 model-weights bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'model-weights',
  'model-weights',
  true,
  524288000
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PART 17: STORAGE POLICIES
-- ============================================================

-- Policy: Auth uploads to inspection-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Auth uploads' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth uploads" ON storage.objects 
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'inspection-images');
  END IF;
END $$;

-- Policy: Public read inspection-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public read inspection' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read inspection" ON storage.objects 
    FOR SELECT TO anon
    USING (bucket_id = 'inspection-images');
  END IF;
END $$;

-- Policy: Public read model-weights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public read models' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read models" ON storage.objects
    FOR SELECT TO anon 
    USING (bucket_id = 'model-weights');
  END IF;
END $$;

-- Policy: Service upload model-weights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service upload models' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Service upload models" ON storage.objects
    FOR INSERT TO service_role 
    WITH CHECK (bucket_id = 'model-weights');
  END IF;
END $$;

-- ============================================================
-- SETUP COMPLETE!
-- ============================================================
-- Total: 22 tables, 2 RPC functions, 2 storage buckets
-- 
-- Next steps:
-- 1. Copy Project URL & anon key to .env.local
-- 2. Insert seed data (roles, menu_items, initial user)
-- ============================================================

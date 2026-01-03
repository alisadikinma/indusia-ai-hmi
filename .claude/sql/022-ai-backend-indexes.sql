-- =============================================
-- AI Backend Performance Indexes
-- Phase 14: Validation & Database
-- =============================================
-- Performance indexes for AI Backend queries

-- Inspections
CREATE INDEX IF NOT EXISTS idx_inspections_external_id
  ON inspections(external_inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspections_line_id
  ON inspections(line_id);
CREATE INDEX IF NOT EXISTS idx_inspections_ai_decision
  ON inspections(ai_decision);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at
  ON inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_work_order
  ON inspections(work_order_id);

-- AI Models
CREATE INDEX IF NOT EXISTS idx_ai_models_status
  ON ai_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_models_name_version
  ON ai_models(name, version);

-- Training Jobs
CREATE INDEX IF NOT EXISTS idx_training_jobs_status
  ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_dataset
  ON training_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created
  ON training_jobs(created_at DESC);

-- Training Metrics
CREATE INDEX IF NOT EXISTS idx_training_metrics_job
  ON training_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_epoch
  ON training_metrics(job_id, epoch);

-- Dataset Images
CREATE INDEX IF NOT EXISTS idx_dataset_images_source
  ON dataset_images(source);
CREATE INDEX IF NOT EXISTS idx_dataset_images_labeled
  ON dataset_images(is_labeled);

-- System Status
CREATE INDEX IF NOT EXISTS idx_system_status_component
  ON system_status(component, component_id);

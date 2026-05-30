-- =============================================
-- Training Pipeline Foreign Key Constraints
-- Phase 14: Validation & Database
-- =============================================
-- Foreign key constraints for training pipeline

-- Training Jobs -> Datasets
ALTER TABLE training_jobs
  ADD CONSTRAINT fk_training_jobs_dataset
  FOREIGN KEY (dataset_id) REFERENCES training_datasets(id)
  ON DELETE RESTRICT;

-- Training Jobs -> Base Model
ALTER TABLE training_jobs
  ADD CONSTRAINT fk_training_jobs_base_model
  FOREIGN KEY (base_model_id) REFERENCES ai_models(id)
  ON DELETE SET NULL;

-- AI Models -> Training Job
ALTER TABLE ai_models
  ADD CONSTRAINT fk_ai_models_training_job
  FOREIGN KEY (training_job_id) REFERENCES training_jobs(id)
  ON DELETE SET NULL;

-- Training Metrics -> Training Jobs
ALTER TABLE training_metrics
  ADD CONSTRAINT fk_training_metrics_job
  FOREIGN KEY (job_id) REFERENCES training_jobs(id)
  ON DELETE CASCADE;

-- Training Dataset Images -> Dataset
ALTER TABLE training_dataset_images
  ADD CONSTRAINT fk_tdi_dataset
  FOREIGN KEY (dataset_id) REFERENCES training_datasets(id)
  ON DELETE CASCADE;

-- Training Dataset Images -> Image
ALTER TABLE training_dataset_images
  ADD CONSTRAINT fk_tdi_image
  FOREIGN KEY (image_id) REFERENCES dataset_images(id)
  ON DELETE CASCADE;

-- Unique constraint on dataset-image pair
ALTER TABLE training_dataset_images
  ADD CONSTRAINT uq_training_dataset_images
  UNIQUE (dataset_id, image_id);

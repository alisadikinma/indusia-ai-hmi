# Phase 14: Zod Validation Schemas & Database Migrations

## Objective
Create comprehensive Zod validation schemas for AI Backend API and database migration scripts.

---

## Task 1: AI Backend Validation Schemas

### 1.1 `lib/validations/aiSchemas.js`

```javascript
/**
 * Zod Schemas for AI Backend API
 */

import { z } from 'zod'

// ============================================
// Common Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const uuidSchema = z.string().uuid()

export const timestampSchema = z.string().datetime()

// ============================================
// Inspection Schemas
// ============================================

export const detectionObjectSchema = z.object({
  name: z.string(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  label: z.number().int(),
  score: z.number().min(0).max(1),
  crop_url: z.string().optional()
})

export const inspectionSideSchema = z.object({
  image_url: z.string(),
  objects: z.array(detectionObjectSchema).default([])
})

export const createAiInspectionSchema = z.object({
  external_inspection_id: z.string().min(1).max(100),
  line_id: z.string(),
  model_id: z.string().uuid().optional(),
  model_name: z.string().optional(),
  ai_decision: z.enum(['PASS', 'FAIL']),
  ai_timestamp: timestampSchema,
  results: z.object({
    top: inspectionSideSchema,
    bottom: inspectionSideSchema.optional()
  })
})

export const updateAiInspectionSchema = z.object({
  ai_decision: z.enum(['PASS', 'FAIL']).optional(),
  ai_objects_top: z.array(detectionObjectSchema).optional(),
  ai_objects_bottom: z.array(detectionObjectSchema).optional()
})

// ============================================
// Model Schemas
// ============================================

export const modelStatusSchema = z.enum(['active', 'inactive', 'training', 'deprecated'])

export const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  status: modelStatusSchema.default('inactive'),
  file_path: z.string().optional(),
  config: z.object({}).passthrough().optional(),
  metrics: z.object({}).passthrough().optional(),
  training_job_id: z.string().uuid().optional()
})

export const updateModelSchema = createModelSchema.partial()

// ============================================
// Training Job Schemas
// ============================================

export const jobStatusSchema = z.enum([
  'queued', 'running', 'completed', 'failed', 'cancelled'
])

export const trainingConfigSchema = z.object({
  epochs: z.number().int().min(1).max(1000).default(100),
  batch_size: z.number().int().min(1).max(256).default(16),
  learning_rate: z.number().positive().default(0.001),
  optimizer: z.enum(['adam', 'sgd', 'adamw']).default('adam'),
  image_size: z.number().int().min(320).max(1280).default(640),
  augmentation: z.object({
    enabled: z.boolean().default(true),
    flip_horizontal: z.boolean().default(true),
    flip_vertical: z.boolean().default(false),
    rotate: z.number().min(0).max(45).default(10),
    scale: z.tuple([z.number(), z.number()]).default([0.9, 1.1])
  }).optional()
}).passthrough()

export const createTrainingJobSchema = z.object({
  name: z.string().min(1).max(100),
  dataset_id: z.string().uuid(),
  base_model_id: z.string().uuid().optional(),
  config: trainingConfigSchema
})

export const updateTrainingJobSchema = z.object({
  status: jobStatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  current_epoch: z.number().int().min(0).optional(),
  error_message: z.string().optional(),
  final_metrics: z.object({}).passthrough().optional()
})

// ============================================
// Training Metrics Schema
// ============================================

export const trainingMetricsSchema = z.object({
  job_id: z.string().uuid(),
  epoch: z.number().int().min(0),
  train_loss: z.number(),
  val_loss: z.number().optional(),
  train_accuracy: z.number().min(0).max(1).optional(),
  val_accuracy: z.number().min(0).max(1).optional(),
  learning_rate: z.number().positive().optional(),
  map50: z.number().min(0).max(1).optional(),
  map50_95: z.number().min(0).max(1).optional(),
  metadata: z.object({}).passthrough().optional()
})

export const bulkMetricsSchema = z.object({
  job_id: z.string().uuid(),
  metrics: z.array(trainingMetricsSchema.omit({ job_id: true }))
})

// ============================================
// Dataset Schemas
// ============================================

export const datasetImageSourceSchema = z.enum(['upload', 'inspection', 'augmented'])

export const createDatasetImageSchema = z.object({
  file_path: z.string(),
  file_name: z.string(),
  source: datasetImageSourceSchema.default('upload'),
  annotations: z.array(z.any()).optional(),
  is_labeled: z.boolean().default(false),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  metadata: z.object({}).passthrough().optional()
})

export const createTrainingDatasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'ready', 'locked']).default('draft')
})

export const datasetImagesActionSchema = z.object({
  image_ids: z.array(z.string().uuid()).min(1)
})

// ============================================
// System Status Schemas
// ============================================

export const componentStatusSchema = z.enum(['ONLINE', 'OFFLINE', 'ERROR', 'UNKNOWN'])

export const systemStatusUpdateSchema = z.object({
  component: z.enum(['camera', 'plc', 'ai_model']),
  component_id: z.string().optional(),
  status: componentStatusSchema,
  message: z.string().optional(),
  metadata: z.object({}).passthrough().optional()
})

export const batchSystemStatusSchema = z.object({
  updates: z.array(systemStatusUpdateSchema)
})
```

---

## Task 2: Database Indexes

### 2.1 `.claude/sql/022-ai-backend-indexes.sql`

```sql
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
```

---

## Task 3: Training Pipeline Constraints

### 3.1 `.claude/sql/023-training-pipeline-constraints.sql`

```sql
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
```

---

## Task 4: System Status Seed Data

### 4.1 `.claude/sql/024-system-status-seed.sql`

```sql
-- Initial system status records

INSERT INTO system_status (id, component, component_id, status, message, metadata)
VALUES
  ('ai_model', 'ai_model', NULL, 'UNKNOWN', 'No model loaded', '{}'),
  ('camera-cam-01', 'camera', 'cam-01', 'UNKNOWN', 'Waiting for connection', '{"name": "Top Camera"}'),
  ('camera-cam-02', 'camera', 'cam-02', 'UNKNOWN', 'Waiting for connection', '{"name": "Bottom Camera"}'),
  ('plc-plc-01', 'plc', 'plc-01', 'UNKNOWN', 'Waiting for connection', '{"name": "Conveyor PLC"}')
ON CONFLICT (id) DO NOTHING;
```

---

## Verification Checklist

### Validation Schemas
- [ ] `lib/validations/aiSchemas.js` created
- [ ] Inspection schemas complete
- [ ] Model schemas complete
- [ ] Training job schemas complete
- [ ] Training metrics schemas complete
- [ ] Dataset schemas complete
- [ ] System status schemas complete

### Database Migrations
- [ ] `022-ai-backend-indexes.sql` created
- [ ] `023-training-pipeline-constraints.sql` created
- [ ] `024-system-status-seed.sql` created
- [ ] All SQL scripts tested in Supabase
- [ ] Foreign key constraints applied
- [ ] Indexes created
- [ ] Seed data inserted

### Integration
- [ ] API routes using new schemas
- [ ] Validation errors returned correctly
- [ ] Schema types match database columns

# Database Schema — INDUSIA AI HMI

> **Version:** 1.0.0  
> **Last Updated:** 2026-01-04  
> **Database:** Supabase (PostgreSQL + pgvector)

---

## Table of Contents

- [Overview](#overview)
- [Table Ownership Matrix](#table-ownership-matrix)
- [Schema Diagram](#schema-diagram)
- [Table Definitions](#table-definitions)
  - [Master Data](#master-data)
  - [Production](#production)
  - [Inspection](#inspection)
  - [Training Pipeline](#training-pipeline)
  - [Authentication & RBAC](#authentication--rbac)
  - [System](#system)
  - [Reference](#reference)
- [Indexes](#indexes)
- [Migration Scripts](#migration-scripts)

---

## Overview

The database is shared between **UI (Next.js)** and **AI Backend**. However, AI Backend accesses data through the API layer — not directly to Supabase.

```
┌─────────────────┐     API Layer     ┌─────────────────┐
│   AI Backend    │ ─────────────────▶│   Next.js API   │
└─────────────────┘                   └────────┬────────┘
                                               │
┌─────────────────┐                            │
│   UI (Next.js)  │ ───────────────────────────┤
└─────────────────┘                            │
                                               ▼
                                      ┌─────────────────┐
                                      │    Supabase     │
                                      │   (PostgreSQL)  │
                                      └─────────────────┘
```

---

## Table Ownership Matrix

| Table | UI | AI Backend | Category |
|-------|:--:|:----------:|----------|
| **Master Data** |
| `customers` | RW | R | Master |
| `boards` | RW | R | Master |
| `lines` | RW | R | Master |
| `sections` | RW | R | Master |
| `customer_sections` | RW | R | Master |
| **Production** |
| `work_orders` | RW | R | Production |
| **Inspection** |
| `inspection_results` | RW | RW | **SHARED** |
| `inspection_defects` | R | RW | Inspection |
| `inspection_stats` | RW | R | Inspection |
| **Training Pipeline** |
| `ai_models` | R | RW | Training |
| `dataset_images` | R | RW | Training |
| `training_datasets` | R | RW | Training |
| `training_jobs` | R | RW | Training |
| `training_metrics` | R | RW | Training |
| `sample_images` | R | RW | Training |
| **Auth/RBAC** |
| `users` | RW | - | Auth |
| `roles` | RW | - | Auth |
| `role_menu_permissions` | RW | - | Auth |
| `menu_items` | RW | - | Auth |
| **Reference** |
| `defect_classes` | RW | R | Reference |
| `false_call_reasons` | RW | R | Reference |
| `shift_config` | RW | R | Reference |
| **System** |
| `system_status` | RW | RW | System |
| `system_events` | RW | RW | System |
| `event_log` | RW | RW | System |
| `notifications` | RW | RW | System |
| `sync_queue` | - | RW | System |
| `sync_history` | - | RW | System |
| **Knowledge Base** |
| `kb_articles` | RW | - | KB |
| `kb_embeddings` | RW | - | KB |

**Legend:** R = Read, W = Write, RW = Read/Write, - = No access

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MASTER DATA                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐            │
│  │  customers   │────▶│ customer_sections │◀────│   sections   │            │
│  └──────┬───────┘     └──────────────────┘     └──────────────┘            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                         ┌──────────────┐                 │
│  │    boards    │                         │    lines     │                 │
│  └──────────────┘                         └──────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          work_orders                                  │  │
│  │  • customer_id → customers                                           │  │
│  │  • board_id → boards                                                 │  │
│  │  • line_id → lines                                                   │  │
│  │  • lot_size, completed_qty, good_qty, ng_qty, false_call_qty        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                           │                                 │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INSPECTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      inspection_results (SHARED)                      │  │
│  │                                                                       │  │
│  │  AI Backend Writes:                    UI Writes:                     │  │
│  │  • external_inspection_id              • work_order_id                │  │
│  │  • model_id, model_name                • operator_id                  │  │
│  │  • ai_decision (PASS/FAIL)             • operator_decision (GOOD/NG) │  │
│  │  • ai_timestamp                        • operator_timestamp           │  │
│  │  • ai_image_url_top/bottom             • is_false_call                │  │
│  │  • ai_objects_top/bottom               • false_call_reason_id         │  │
│  │                                        • operator_comment             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                    │                                                        │
│                    ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      inspection_defects                               │  │
│  │  • inspection_id → inspection_results                                │  │
│  │  • defect_class_id → defect_classes                                  │  │
│  │  • bounding_box, confidence, crop_url                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRAINING PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐     ┌─────────────────┐     ┌────────────────┐         │
│  │  ai_models     │◀────│  training_jobs  │────▶│training_metrics│         │
│  └────────────────┘     └────────┬────────┘     └────────────────┘         │
│                                  │                                          │
│                                  ▼                                          │
│                         ┌─────────────────┐                                │
│                         │training_datasets│                                │
│                         └────────┬────────┘                                │
│                                  │                                          │
│                                  ▼                                          │
│  ┌────────────────┐     ┌─────────────────┐                                │
│  │ sample_images  │     │ dataset_images  │                                │
│  └────────────────┘     └─────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### Master Data

#### `customers`

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,           -- Short code (e.g., "ACME")
  address TEXT,
  contact_person VARCHAR(100),
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `boards`

```sql
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  description TEXT,
  side_count INTEGER DEFAULT 1 CHECK (side_count IN (1, 2)),
  cavity_count INTEGER DEFAULT 1 CHECK (cavity_count >= 1),  -- PCBs per panel
  image_url TEXT,                    -- Reference image
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sections`

```sql
CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `lines`

```sql
CREATE TABLE lines (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  section_id TEXT REFERENCES sections(id),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `customer_sections`

```sql
CREATE TABLE customer_sections (
  customer_id TEXT REFERENCES customers(id),
  section_id TEXT REFERENCES sections(id),
  PRIMARY KEY (customer_id, section_id)
);
```

---

### Production

#### `work_orders`

```sql
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number VARCHAR(30) NOT NULL UNIQUE,
  
  -- References
  customer_id TEXT NOT NULL REFERENCES customers(id),
  board_id TEXT NOT NULL REFERENCES boards(id),
  line_id TEXT NOT NULL REFERENCES lines(id),
  section_id TEXT REFERENCES sections(id),
  
  -- Configuration
  lot_size INTEGER NOT NULL DEFAULT 100,
  side_count INTEGER NOT NULL DEFAULT 1 CHECK (side_count IN (1, 2)),
  
  -- Scheduling
  due_date DATE,
  priority INTEGER DEFAULT 0,        -- 0=normal, 50=high, 100=urgent
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'ready', 'active', 'completed', 'closed')),
  
  -- Counters (operator-confirmed)
  completed_qty INTEGER NOT NULL DEFAULT 0,
  good_qty INTEGER NOT NULL DEFAULT 0,
  ng_qty INTEGER NOT NULL DEFAULT 0,
  false_call_qty INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  notes TEXT
);

CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_line ON work_orders(line_id, status);
```

---

### Inspection

#### `inspection_results` (SHARED)

```sql
CREATE TABLE inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- === AI BACKEND WRITES ===
  external_inspection_id VARCHAR(50) UNIQUE,  -- "insp-8e1c4c6b"
  model_id VARCHAR(100),
  model_name VARCHAR(50),
  ai_decision VARCHAR(10),                    -- "PASS" | "FAIL"
  ai_timestamp TIMESTAMPTZ,
  ai_image_url_top TEXT,
  ai_image_url_bottom TEXT,
  ai_objects_top JSONB DEFAULT '[]',
  ai_objects_bottom JSONB DEFAULT '[]',
  
  -- === UI WRITES ===
  work_order_id UUID REFERENCES work_orders(id),
  line_id TEXT REFERENCES lines(id),
  operator_id TEXT REFERENCES users(id),
  operator_decision VARCHAR(10),              -- "GOOD" | "NG"
  operator_timestamp TIMESTAMPTZ,
  is_false_call BOOLEAN DEFAULT FALSE,
  false_call_reason_id TEXT REFERENCES false_call_reasons(id),
  operator_comment TEXT,
  board_sequence INTEGER,
  side VARCHAR(10) DEFAULT 'TOP',
  
  -- === METADATA ===
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_external_id ON inspection_results(external_inspection_id);
CREATE INDEX idx_inspection_work_order ON inspection_results(work_order_id);
CREATE INDEX idx_inspection_line ON inspection_results(line_id);
CREATE INDEX idx_inspection_timestamp ON inspection_results(ai_timestamp DESC);
CREATE INDEX idx_inspection_false_call ON inspection_results(is_false_call) WHERE is_false_call = TRUE;
```

#### `inspection_defects`

```sql
CREATE TABLE inspection_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspection_results(id) ON DELETE CASCADE,
  defect_class_id TEXT REFERENCES defect_classes(id),
  
  -- Bounding box [x1, y1, x2, y2]
  bbox JSONB NOT NULL,
  confidence DECIMAL(5,4),                    -- 0.0000 - 1.0000
  crop_url TEXT,
  side VARCHAR(10) DEFAULT 'TOP',
  
  -- From AI detection
  label INTEGER,                              -- Class label index
  name VARCHAR(50),                           -- Class name from AI
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_defects_inspection ON inspection_defects(inspection_id);
CREATE INDEX idx_inspection_defects_class ON inspection_defects(defect_class_id);
```

#### `inspection_stats`

```sql
CREATE TABLE inspection_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id TEXT NOT NULL REFERENCES lines(id),
  shift_date DATE NOT NULL,
  shift_number INTEGER NOT NULL,              -- 1, 2, 3
  
  -- Counters
  total_inspected INTEGER DEFAULT 0,
  total_pass INTEGER DEFAULT 0,
  total_fail INTEGER DEFAULT 0,
  total_false_call INTEGER DEFAULT 0,
  
  -- Calculated
  yield_percent DECIMAL(5,2),
  false_call_rate DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(line_id, shift_date, shift_number)
);
```

---

### Training Pipeline

#### `ai_models`

```sql
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'inactive' 
    CHECK (status IN ('active', 'inactive', 'training', 'deprecated')),
  
  file_path TEXT,                             -- Path to model file
  config JSONB DEFAULT '{}',                  -- Model configuration
  metrics JSONB DEFAULT '{}',                 -- Performance metrics
  
  training_job_id UUID,                       -- Reference to training job
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, version)
);
```

#### `dataset_images`

```sql
CREATE TABLE dataset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  source VARCHAR(20) DEFAULT 'inspection'     -- inspection/upload/augmented
    CHECK (source IN ('inspection', 'upload', 'augmented')),
  source_id VARCHAR(100),                     -- Reference to source (e.g., inspection_id)
  
  width INTEGER,
  height INTEGER,
  
  is_labeled BOOLEAN DEFAULT FALSE,
  annotations JSONB DEFAULT '[]',             -- Array of annotations
  
  metadata JSONB DEFAULT '{}',                -- Additional metadata
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dataset_images_source ON dataset_images(source, source_id);
CREATE INDEX idx_dataset_images_labeled ON dataset_images(is_labeled);
```

#### `training_datasets`

```sql
CREATE TABLE training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'in_use', 'archived')),
  
  total_images INTEGER DEFAULT 0,
  labeled_images INTEGER DEFAULT 0,
  
  split_ratio JSONB DEFAULT '{"train": 0.7, "val": 0.2, "test": 0.1}',
  classes JSONB DEFAULT '[]',                 -- Array of class names
  class_distribution JSONB DEFAULT '{}',      -- Count per class
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `training_dataset_images` (Junction Table)

```sql
CREATE TABLE training_dataset_images (
  dataset_id UUID REFERENCES training_datasets(id) ON DELETE CASCADE,
  image_id UUID REFERENCES dataset_images(id) ON DELETE CASCADE,
  split VARCHAR(10) DEFAULT 'train'           -- train/val/test
    CHECK (split IN ('train', 'val', 'test')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dataset_id, image_id)
);
```

#### `training_jobs`

```sql
CREATE TABLE training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  
  dataset_id UUID REFERENCES training_datasets(id),
  base_model_id UUID REFERENCES ai_models(id),
  output_model_id UUID REFERENCES ai_models(id),
  
  status VARCHAR(20) DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  
  progress INTEGER DEFAULT 0,                 -- 0-100
  current_epoch INTEGER DEFAULT 0,
  total_epochs INTEGER,
  
  config JSONB DEFAULT '{}',                  -- Training configuration
  current_metrics JSONB DEFAULT '{}',         -- Latest metrics
  final_metrics JSONB DEFAULT '{}',           -- Final metrics on completion
  
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_training_jobs_status ON training_jobs(status);
```

#### `training_metrics`

```sql
CREATE TABLE training_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
  
  epoch INTEGER NOT NULL,
  
  train_loss DECIMAL(10,6),
  val_loss DECIMAL(10,6),
  train_accuracy DECIMAL(5,4),
  val_accuracy DECIMAL(5,4),
  learning_rate DECIMAL(10,8),
  
  additional_metrics JSONB DEFAULT '{}',      -- f1, precision, recall, etc.
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_metrics_job ON training_metrics(job_id, epoch);
```

#### `sample_images`

```sql
CREATE TABLE sample_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  category VARCHAR(20) DEFAULT 'reference'
    CHECK (category IN ('good', 'defect', 'reference')),
  
  board_id TEXT REFERENCES boards(id),
  description TEXT,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Authentication & RBAC

#### `users`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,             -- bcrypt hashed
  role_id TEXT REFERENCES roles(id),
  sections TEXT[] DEFAULT '{}',               -- Array of section IDs
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `roles`

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `menu_items`

```sql
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  path VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  parent_id TEXT REFERENCES menu_items(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `role_menu_permissions`

```sql
CREATE TABLE role_menu_permissions (
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  menu_id TEXT REFERENCES menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, menu_id)
);
```

---

### Reference

#### `defect_classes`

```sql
CREATE TABLE defect_classes (
  id TEXT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'major'
    CHECK (severity IN ('critical', 'major', 'minor')),
  color VARCHAR(7),                           -- Hex color for UI
  ipc_code VARCHAR(20),                       -- IPC-A-610 reference
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `false_call_reasons`

```sql
CREATE TABLE false_call_reasons (
  id TEXT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `shift_config`

```sql
CREATE TABLE shift_config (
  id TEXT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  shift_number INTEGER NOT NULL,              -- 1, 2, 3
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### System

#### `system_status`

```sql
CREATE TABLE system_status (
  id TEXT PRIMARY KEY,
  component VARCHAR(50) NOT NULL,             -- ai_model, camera, plc
  component_id VARCHAR(50),                   -- e.g., cam-01, plc-01
  status VARCHAR(20) DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'warning', 'error', 'unknown')),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(component, component_id)
);
```

#### `event_log`

```sql
CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  event_source VARCHAR(50),                   -- ui, ai_backend, system
  user_id TEXT REFERENCES users(id),
  resource_type VARCHAR(50),
  resource_id TEXT,
  action VARCHAR(50),
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_log_type ON event_log(event_type);
CREATE INDEX idx_event_log_created ON event_log(created_at DESC);
```

#### `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  link VARCHAR(200),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

#### `system_events`

```sql
CREATE TABLE system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  source VARCHAR(50),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Indexes

Key indexes for performance:

```sql
-- Inspection queries
CREATE INDEX idx_inspection_external_id ON inspection_results(external_inspection_id);
CREATE INDEX idx_inspection_work_order ON inspection_results(work_order_id);
CREATE INDEX idx_inspection_line_time ON inspection_results(line_id, ai_timestamp DESC);

-- Work order queries
CREATE INDEX idx_work_orders_line_status ON work_orders(line_id, status);
CREATE INDEX idx_work_orders_active ON work_orders(status) WHERE status = 'active';

-- Training queries
CREATE INDEX idx_training_jobs_status ON training_jobs(status);
CREATE INDEX idx_dataset_images_labeled ON dataset_images(is_labeled);

-- Event log queries
CREATE INDEX idx_event_log_created ON event_log(created_at DESC);
CREATE INDEX idx_event_log_resource ON event_log(resource_type, resource_id);
```

---

## Migration Scripts

Located in `.claude/sql/`:

| File | Description |
|------|-------------|
| `indusia_supabase_setup.sql` | Complete initial schema |
| `indusia_seed_data.sql` | Seed data (roles, users, etc.) |
| `007-inspection-results.sql` | Inspection tables |
| `008-seed-defect-data.sql` | Defect class seed |
| `014-customer-code.sql` | Add customer code field |
| `015-work-order-permissions.sql` | WO RBAC permissions |
| `018-work-orders-complete.sql` | Work orders table |
| `020-inspection-results-v2.sql` | SSE-based schema update |
| `021-training-pipeline.sql` | Training tables |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-04 | Initial schema documentation |

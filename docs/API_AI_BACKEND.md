# API Contract — AI Backend Integration

> **Version:** 1.0.0  
> **Last Updated:** 2026-01-04  
> **Base URL:** `http://localhost:3000/api/ai`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Common Response Format](#common-response-format)
- [Error Codes](#error-codes)
- [Endpoints](#endpoints)
  - [1. Inspections](#1-inspections)
  - [2. AI Models](#2-ai-models)
  - [3. Dataset Images](#3-dataset-images)
  - [4. Training Datasets](#4-training-datasets)
  - [5. Training Jobs](#5-training-jobs)
  - [6. Training Metrics](#6-training-metrics)
  - [7. Sample Images](#7-sample-images)
  - [8. Defect Classes](#8-defect-classes)
  - [9. False Call Reasons](#9-false-call-reasons)
  - [10. System Status](#10-system-status)
- [SSE Events Reference](#sse-events-reference)
- [Webhook Callbacks](#webhook-callbacks)

---

## Overview

This API allows the AI Backend to communicate with the INDUSIA HMI system database. All data operations go through this API layer — AI Backend does **not** connect directly to Supabase.

### Architecture

```
┌─────────────────┐      REST API      ┌─────────────────┐      ┌──────────┐
│   AI Backend    │ ──────────────────▶│   Next.js API   │─────▶│ Supabase │
│  (Python/Fast)  │                    │   /api/ai/*     │      │   (DB)   │
└─────────────────┘                    └─────────────────┘      └──────────┘
        │
        │ SSE Events
        ▼
┌─────────────────┐
│   UI (Next.js)  │
│   LiveView      │
└─────────────────┘
```

### Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **AI Backend** | Camera capture, AI inference, PLC control, image storage |
| **Next.js API** | Database operations, validation, authentication |
| **UI** | Display results, operator confirmation, WO management |

---

## Authentication

All AI Backend endpoints require API key authentication.

### Header

```
X-API-Key: {AI_BACKEND_API_KEY}
```

### Environment Variable

```env
AI_BACKEND_API_KEY=your-secure-api-key-here
```

### Unauthorized Response

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

---

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key valid but action not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `DUPLICATE_ENTRY` | 409 | Record already exists |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Endpoints

---

### 1. Inspections

Manage inspection records created by AI detection.

#### 1.1 Create Inspection

**POST** `/api/ai/inspections`

Creates a new inspection record when AI completes detection.

**Request Body:**

```json
{
  "external_inspection_id": "insp-8e1c4c6b",
  "line_id": "3",
  "model_id": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
  "model_name": "pcb_1",
  "ai_decision": "PASS",
  "ai_timestamp": "2026-01-03T13:41:31Z",
  "results": {
    "top": {
      "image_url": "http://localhost:8001/static/images/2026-01-03_20-41-31-758605.png",
      "objects": [
        {
          "name": "target-d",
          "box": [2405, 881.5, 2466, 922.5],
          "label": 0,
          "score": 1.0,
          "crop_url": "http://localhost:8001/static/crops/top_0.png"
        }
      ]
    },
    "bottom": {
      "image_url": "",
      "objects": []
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "external_inspection_id": "insp-8e1c4c6b",
    "line_id": "3",
    "ai_decision": "PASS",
    "created_at": "2026-01-03T13:41:31Z"
  }
}
```

---

#### 1.2 Get Inspection by External ID

**GET** `/api/ai/inspections/{external_inspection_id}`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "external_inspection_id": "insp-8e1c4c6b",
    "line_id": "3",
    "model_id": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
    "model_name": "pcb_1",
    "ai_decision": "PASS",
    "ai_timestamp": "2026-01-03T13:41:31Z",
    "ai_image_url_top": "http://localhost:8001/static/images/xxx.png",
    "ai_image_url_bottom": null,
    "ai_objects_top": [...],
    "ai_objects_bottom": [],
    "operator_decision": "GOOD",
    "operator_timestamp": "2026-01-03T13:41:45Z",
    "is_false_call": false,
    "work_order_id": "uuid-xxx",
    "created_at": "2026-01-03T13:41:31Z",
    "updated_at": "2026-01-03T13:41:45Z"
  }
}
```

---

#### 1.3 List Inspections

**GET** `/api/ai/inspections`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `line_id` | string | Filter by line |
| `ai_decision` | string | Filter by AI decision (PASS/FAIL) |
| `is_false_call` | boolean | Filter false calls only |
| `date_from` | ISO date | Start date filter |
| `date_to` | ISO date | End date filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Response:**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 1523,
    "page": 1,
    "limit": 20,
    "total_pages": 77
  }
}
```

---

#### 1.4 Update Inspection

**PATCH** `/api/ai/inspections/{external_inspection_id}`

For updating AI-side data if needed (e.g., re-processing).

**Request Body:**

```json
{
  "ai_decision": "FAIL",
  "ai_objects_top": [...]
}
```

---

### 2. AI Models

Manage AI model registry.

#### 2.1 List Models

**GET** `/api/ai/models`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (active/inactive/training) |
| `name` | string | Search by name |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
      "name": "pcb_1",
      "version": "1.0.0",
      "status": "active",
      "description": "PCB defect detection model",
      "config": {
        "threshold": 0.85,
        "classes": ["target-d", "target-u", "solder_bridge"]
      },
      "metrics": {
        "accuracy": 0.95,
        "f1_score": 0.92,
        "inference_time_ms": 45
      },
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-03T10:00:00Z"
    }
  ]
}
```

---

#### 2.2 Create Model

**POST** `/api/ai/models`

**Request Body:**

```json
{
  "name": "pcb_1",
  "version": "1.0.0",
  "description": "PCB defect detection model",
  "status": "active",
  "file_path": "/models/pcb_1_v1.0.0.pt",
  "config": {
    "threshold": 0.85,
    "input_size": [640, 640],
    "classes": ["target-d", "target-u", "solder_bridge"]
  },
  "metrics": {
    "accuracy": 0.95,
    "f1_score": 0.92,
    "precision": 0.94,
    "recall": 0.91
  },
  "training_job_id": "uuid-xxx"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
    "name": "pcb_1",
    "version": "1.0.0",
    "status": "active",
    "created_at": "2026-01-03T10:00:00Z"
  }
}
```

---

#### 2.3 Get Model

**GET** `/api/ai/models/{id}`

---

#### 2.4 Update Model

**PATCH** `/api/ai/models/{id}`

**Request Body:**

```json
{
  "status": "inactive",
  "metrics": {
    "accuracy": 0.96,
    "total_inferences": 15000
  }
}
```

---

#### 2.5 Delete Model

**DELETE** `/api/ai/models/{id}`

**Response:**

```json
{
  "success": true,
  "message": "Model deleted successfully"
}
```

---

### 3. Dataset Images

Manage images for training datasets.

#### 3.1 List Dataset Images

**GET** `/api/ai/dataset-images`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `dataset_id` | string | Filter by dataset |
| `source` | string | Filter by source (inspection/upload/augmented) |
| `is_labeled` | boolean | Filter labeled/unlabeled |
| `label` | string | Filter by label/class |
| `page` | number | Page number |
| `limit` | number | Items per page |

---

#### 3.2 Create Dataset Image

**POST** `/api/ai/dataset-images`

**Request Body:**

```json
{
  "image_url": "http://localhost:8001/static/images/xxx.png",
  "thumbnail_url": "http://localhost:8001/static/thumbs/xxx.png",
  "source": "inspection",
  "source_id": "insp-8e1c4c6b",
  "width": 4096,
  "height": 3072,
  "is_labeled": true,
  "annotations": [
    {
      "class_id": "defect-001",
      "class_name": "solder_bridge",
      "box": [100, 200, 150, 250],
      "confidence": 1.0
    }
  ],
  "metadata": {
    "line_id": "3",
    "board_id": "board-001",
    "side": "TOP"
  }
}
```

---

#### 3.3 Get Dataset Image

**GET** `/api/ai/dataset-images/{id}`

---

#### 3.4 Update Dataset Image

**PATCH** `/api/ai/dataset-images/{id}`

Update annotations/labels.

**Request Body:**

```json
{
  "is_labeled": true,
  "annotations": [
    {
      "class_id": "defect-001",
      "class_name": "solder_bridge",
      "box": [100, 200, 150, 250],
      "confidence": 1.0
    }
  ]
}
```

---

#### 3.5 Delete Dataset Image

**DELETE** `/api/ai/dataset-images/{id}`

---

#### 3.6 Bulk Create Dataset Images

**POST** `/api/ai/dataset-images/bulk`

**Request Body:**

```json
{
  "images": [
    { "image_url": "...", "source": "inspection", ... },
    { "image_url": "...", "source": "inspection", ... }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "created": 50,
    "failed": 2,
    "errors": [
      { "index": 12, "error": "Duplicate image URL" }
    ]
  }
}
```

---

### 4. Training Datasets

Manage training dataset collections.

#### 4.1 List Training Datasets

**GET** `/api/ai/training-datasets`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (draft/ready/in_use/archived) |

---

#### 4.2 Create Training Dataset

**POST** `/api/ai/training-datasets`

**Request Body:**

```json
{
  "name": "PCB Defects v2",
  "description": "Training dataset for PCB defect detection",
  "status": "draft",
  "split_ratio": {
    "train": 0.7,
    "val": 0.2,
    "test": 0.1
  },
  "classes": ["solder_bridge", "missing_component", "tombstone"],
  "metadata": {
    "board_types": ["board-001", "board-002"],
    "date_range": {
      "from": "2026-01-01",
      "to": "2026-01-03"
    }
  }
}
```

---

#### 4.3 Get Training Dataset

**GET** `/api/ai/training-datasets/{id}`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "name": "PCB Defects v2",
    "status": "ready",
    "total_images": 5000,
    "labeled_images": 4800,
    "class_distribution": {
      "solder_bridge": 1200,
      "missing_component": 800,
      "tombstone": 600,
      "good": 2200
    },
    "split_ratio": { "train": 0.7, "val": 0.2, "test": 0.1 },
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### 4.4 Update Training Dataset

**PATCH** `/api/ai/training-datasets/{id}`

---

#### 4.5 Delete Training Dataset

**DELETE** `/api/ai/training-datasets/{id}`

---

#### 4.6 Add Images to Dataset

**POST** `/api/ai/training-datasets/{id}/images`

**Request Body:**

```json
{
  "image_ids": [
    "img-uuid-1",
    "img-uuid-2",
    "img-uuid-3"
  ]
}
```

---

#### 4.7 Remove Images from Dataset

**DELETE** `/api/ai/training-datasets/{id}/images`

**Request Body:**

```json
{
  "image_ids": ["img-uuid-1", "img-uuid-2"]
}
```

---

### 5. Training Jobs

Manage AI model training jobs.

#### 5.1 List Training Jobs

**GET** `/api/ai/training-jobs`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: queued/running/completed/failed/cancelled |
| `dataset_id` | string | Filter by dataset |

---

#### 5.2 Create Training Job

**POST** `/api/ai/training-jobs`

**Request Body:**

```json
{
  "name": "PCB Model Training v1.1",
  "dataset_id": "uuid-xxx",
  "base_model_id": "uuid-base",
  "config": {
    "epochs": 100,
    "batch_size": 32,
    "learning_rate": 0.001,
    "optimizer": "adam",
    "augmentation": {
      "horizontal_flip": true,
      "rotation": 15,
      "brightness": 0.2
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "job-uuid-xxx",
    "name": "PCB Model Training v1.1",
    "status": "queued",
    "created_at": "2026-01-03T10:00:00Z"
  }
}
```

---

#### 5.3 Get Training Job

**GET** `/api/ai/training-jobs/{id}`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "job-uuid-xxx",
    "name": "PCB Model Training v1.1",
    "status": "running",
    "progress": 45,
    "current_epoch": 45,
    "total_epochs": 100,
    "started_at": "2026-01-03T10:05:00Z",
    "estimated_completion": "2026-01-03T12:30:00Z",
    "current_metrics": {
      "train_loss": 0.023,
      "val_loss": 0.031,
      "train_accuracy": 0.92,
      "val_accuracy": 0.89
    }
  }
}
```

---

#### 5.4 Update Training Job Status

**PATCH** `/api/ai/training-jobs/{id}`

Called by AI Backend to update job progress.

**Request Body:**

```json
{
  "status": "running",
  "progress": 45,
  "current_epoch": 45,
  "current_metrics": {
    "train_loss": 0.023,
    "val_loss": 0.031,
    "train_accuracy": 0.92,
    "val_accuracy": 0.89
  }
}
```

**On Completion:**

```json
{
  "status": "completed",
  "progress": 100,
  "completed_at": "2026-01-03T12:30:00Z",
  "output_model_id": "new-model-uuid",
  "final_metrics": {
    "accuracy": 0.95,
    "f1_score": 0.93,
    "precision": 0.94,
    "recall": 0.92
  }
}
```

---

#### 5.5 Cancel Training Job

**POST** `/api/ai/training-jobs/{id}/cancel`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "job-uuid-xxx",
    "status": "cancelled",
    "cancelled_at": "2026-01-03T11:00:00Z"
  }
}
```

---

### 6. Training Metrics

Log detailed training metrics per epoch.

#### 6.1 List Metrics for Job

**GET** `/api/ai/training-metrics?job_id={job_id}`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "metric-uuid",
      "job_id": "job-uuid-xxx",
      "epoch": 1,
      "train_loss": 0.5,
      "val_loss": 0.6,
      "train_accuracy": 0.7,
      "val_accuracy": 0.65,
      "learning_rate": 0.001,
      "timestamp": "2026-01-03T10:06:00Z"
    },
    ...
  ]
}
```

---

#### 6.2 Log Training Metrics

**POST** `/api/ai/training-metrics`

Called by AI Backend after each epoch.

**Request Body:**

```json
{
  "job_id": "job-uuid-xxx",
  "epoch": 23,
  "train_loss": 0.023,
  "val_loss": 0.031,
  "train_accuracy": 0.92,
  "val_accuracy": 0.89,
  "learning_rate": 0.0001,
  "additional_metrics": {
    "f1_score": 0.90,
    "precision": 0.91,
    "recall": 0.89,
    "confusion_matrix": [[100, 5], [8, 120]]
  }
}
```

---

#### 6.3 Bulk Log Metrics

**POST** `/api/ai/training-metrics/bulk`

For batch logging multiple epochs.

**Request Body:**

```json
{
  "job_id": "job-uuid-xxx",
  "metrics": [
    { "epoch": 1, "train_loss": 0.5, ... },
    { "epoch": 2, "train_loss": 0.4, ... }
  ]
}
```

---

### 7. Sample Images

Manage sample/reference images for testing.

#### 7.1 List Sample Images

**GET** `/api/ai/sample-images`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter: good/defect/reference |
| `board_id` | string | Filter by board type |

---

#### 7.2 Create Sample Image

**POST** `/api/ai/sample-images`

**Request Body:**

```json
{
  "image_url": "http://localhost:8001/static/samples/good_001.png",
  "thumbnail_url": "http://localhost:8001/static/samples/thumbs/good_001.png",
  "category": "good",
  "board_id": "board-001",
  "description": "Reference good board - TOP side",
  "metadata": {
    "side": "TOP",
    "capture_date": "2026-01-01"
  }
}
```

---

#### 7.3 Delete Sample Image

**DELETE** `/api/ai/sample-images/{id}`

---

### 8. Defect Classes

Reference data for defect types (read-only for AI Backend).

#### 8.1 List Defect Classes

**GET** `/api/ai/defect-classes`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "defect-001",
      "code": "SOLDER_BRIDGE",
      "name": "Solder Bridge",
      "description": "Unintended solder connection between adjacent pins",
      "severity": "critical",
      "color": "#EF4444",
      "ipc_code": "IPC-610-7.1.1"
    },
    {
      "id": "defect-002",
      "code": "MISSING_COMPONENT",
      "name": "Missing Component",
      "description": "Component not placed on PCB",
      "severity": "critical",
      "color": "#F59E0B"
    }
  ]
}
```

---

#### 8.2 Get Defect Class

**GET** `/api/ai/defect-classes/{id}`

---

### 9. False Call Reasons

Reference data for false call categorization (read-only).

#### 9.1 List False Call Reasons

**GET** `/api/ai/false-call-reasons`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "fcr-001",
      "code": "REFLECTION",
      "name": "Lighting Reflection",
      "description": "False detection caused by lighting reflection"
    },
    {
      "id": "fcr-002",
      "code": "ACCEPTABLE_VARIATION",
      "name": "Acceptable Variation",
      "description": "Within acceptable tolerance per IPC standard"
    },
    {
      "id": "fcr-003",
      "code": "WRONG_CLASSIFICATION",
      "name": "Wrong Classification",
      "description": "AI detected wrong defect type"
    },
    {
      "id": "fcr-004",
      "code": "NORMAL_SOLDER",
      "name": "Normal Solder Joint",
      "description": "Normal solder joint misidentified as defect"
    },
    {
      "id": "fcr-005",
      "code": "OTHER",
      "name": "Other",
      "description": "Other reason (see comment)"
    }
  ]
}
```

---

### 10. System Status

Hardware status updates from AI Backend.

#### 10.1 Get System Status

**GET** `/api/ai/system-status`

**Response:**

```json
{
  "success": true,
  "data": {
    "ai_model": {
      "status": "online",
      "model_name": "pcb_1",
      "model_version": "1.0.0",
      "last_inference": "2026-01-03T14:30:00Z",
      "gpu_usage": 45
    },
    "cameras": [
      {
        "id": "cam-01",
        "name": "Top Camera",
        "status": "online",
        "message": null
      },
      {
        "id": "cam-02",
        "name": "Bottom Camera",
        "status": "offline",
        "message": "Connection timeout"
      }
    ],
    "plcs": [
      {
        "id": "plc-01",
        "name": "Conveyor PLC",
        "status": "online",
        "message": null
      }
    ],
    "last_updated": "2026-01-03T14:30:00Z"
  }
}
```

---

#### 10.2 Update System Status

**POST** `/api/ai/system-status`

AI Backend calls this to update hardware status.

**Request Body:**

```json
{
  "component": "camera",
  "component_id": "cam-02",
  "status": "offline",
  "message": "Connection timeout",
  "metadata": {
    "last_frame": "2026-01-03T14:29:55Z",
    "error_code": "CAM_TIMEOUT"
  }
}
```

**Or batch update:**

```json
{
  "updates": [
    {
      "component": "ai_model",
      "status": "online",
      "metadata": { "gpu_usage": 45, "model_name": "pcb_1" }
    },
    {
      "component": "camera",
      "component_id": "cam-01",
      "status": "online"
    },
    {
      "component": "plc",
      "component_id": "plc-01",
      "status": "online"
    }
  ]
}
```

---

## SSE Events Reference

AI Backend sends these SSE events to UI. Documented here for reference.

### Event: `inspection`

```json
{
  "inspection_id": "insp-8e1c4c6b",
  "model_id": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
  "model_name": "pcb_1",
  "results": {
    "top": {
      "image_url": "http://localhost:8001/static/images/2026-01-03_20-41-31-758605.png",
      "objects": [
        {
          "name": "target-d",
          "box": [2405, 881.5, 2466, 922.5],
          "label": 0,
          "score": 1.0,
          "crop_url": "http://localhost:8001/static/crops/top_0.png"
        }
      ]
    },
    "bottom": {
      "image_url": "",
      "objects": []
    }
  },
  "decision": "PASS",
  "timestamp": "2026-01-03T13:41:31Z"
}
```

### Event: `hardware_status`

```json
{
  "status_id": "status-20260103-001",
  "timestamp": "2026-01-03T14:00:00Z",
  "hardware": {
    "cameras": [
      { "id": "cam-01", "name": "Top Camera", "status": "ONLINE", "message": null },
      { "id": "cam-02", "name": "Bottom Camera", "status": "OFFLINE", "message": "Connection timeout" }
    ],
    "plcs": [
      { "id": "plc-01", "name": "Conveyor PLC", "status": "ONLINE", "message": null }
    ]
  }
}
```

### Event: `running_status`

```json
{
  "status_id": "run-20260103-003",
  "timestamp": "2026-01-03T15:15:00Z",
  "stage_id": "stage-03",
  "stage_name": "camera_position_2",
  "completed": false,
  "stage_timestamp": null
}
```

---

## Webhook Callbacks

_(Optional — for future implementation)_

AI Backend can register webhooks to receive notifications:

| Event | Description |
|-------|-------------|
| `inspection.confirmed` | Operator confirmed inspection result |
| `work_order.started` | Work order activated |
| `work_order.completed` | Work order finished |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-04 | Initial API contract |

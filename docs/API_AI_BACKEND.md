# API Contract — AI Backend Integration

> **Version:** 2.0.0  
> **Last Updated:** 2026-01-07  
> **Base URL:** `http://localhost:3000/api/ai`

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [Common Response Format](#common-response-format)
- [Error Codes](#error-codes)
- [Endpoints](#endpoints)
  - [1. Inspections](#1-inspections)
  - [2. AI Models](#2-ai-models)
  - [3. Boards](#3-boards) ← **NEW**
  - [4. Lines](#4-lines) ← **NEW**
  - [5. Dataset Images](#5-dataset-images)
  - [6. Training Datasets](#6-training-datasets)
  - [7. Training Jobs](#7-training-jobs)
  - [8. Training Metrics](#8-training-metrics)
  - [9. Sample Images](#9-sample-images)
  - [10. Defect Classes](#10-defect-classes)
  - [11. False Call Reasons](#11-false-call-reasons)
  - [12. System Status](#12-system-status)
- [Image Storage](#image-storage) ← **NEW**
- [Work Order Integration](#work-order-integration) ← **NEW**
- [SSE Events Reference](#sse-events-reference)
- [Webhook Callbacks](#webhook-callbacks)

---

## Overview

This API allows the AI Backend to communicate with the INDUSIA HMI system database. All data operations go through this API layer — AI Backend does **not** connect directly to the database.

### Key Principles

1. **AI Backend serves images** — All inspection images are stored and served by AI Backend via HTTP
2. **Model assigned per line** — Each line has an assigned AI model
3. **UI handles operator decisions** — GOOD/NG workflow is managed by UI
4. **False calls uploaded to cloud** — For retraining purposes

---

## Architecture

### Hybrid Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FACTORY FLOOR (Offline Network)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │   AI Backend    │──────── SSE Events ──────────┐                        │
│   │   (FastAPI)     │                              │                        │
│   │   port: 8001    │                              ▼                        │
│   │                 │                        ┌─────────────┐                │
│   │ • Camera capture│                        │  Next.js    │                │
│   │ • AI inference  │                        │  UI (HMI)   │                │
│   │ • PLC control   │◀── POST /confirm ──────│  port: 3000 │                │
│   │ • Image storage │                        │             │                │
│   └────────┬────────┘                        └──────┬──────┘                │
│            │                                        │                       │
│            │ Images served                          │ REST API              │
│            │ via HTTP                               │ /api/ai/*             │
│            │                                        │                       │
│            ▼                                        ▼                       │
│   ┌─────────────────┐                        ┌─────────────┐                │
│   │  Static Files   │                        │   Local DB  │                │
│   │  /static/images │                        │ PostgreSQL  │                │
│   │  /static/crops  │                        │  port:5432  │                │
│   └─────────────────┘                        └──────┬──────┘                │
│                                                     │                       │
└─────────────────────────────────────────────────────┼───────────────────────┘
                                                      │
                               ┌──────────────────────┴───────────────────────┐
                               │               OFFICE (Internet)               │
                               ├───────────────────────────────────────────────┤
                               │                                               │
                               │   ┌─────────────┐     Sync every 15 min       │
                               │   │  Office PC  │ ──────────────────────┐     │
                               │   │  (Bridge)   │                       │     │
                               │   │             │                       ▼     │
                               │   │ Dual NIC:   │              ┌─────────────┐│
                               │   │ • Factory   │              │  Supabase   ││
                               │   │ • Internet  │              │   Cloud     ││
                               │   └─────────────┘              │             ││
                               │                                │ • Database  ││
                               │                                │ • Storage   ││
                               │                                └─────────────┘│
                               └───────────────────────────────────────────────┘
```

### Data Flow Summary

| Flow | Path |
|------|------|
| AI Backend → UI | SSE events (inspection results, hardware status) |
| UI → AI Backend | POST /confirm (operator decision → PLC trigger) |
| UI → Local DB | REST API via Next.js routes |
| Local DB → Cloud | Background sync every 15 minutes |
| False call images | UI → Supabase Storage (for retraining) |

### Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **AI Backend** | Camera capture, AI inference, PLC control, image storage & serving |
| **Next.js API** | Database operations, validation, authentication |
| **UI** | Display results, operator GOOD/NG decisions, WO management |
| **Supabase Cloud** | Backup, analytics, false call image storage |

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
    "externalInspectionId": "insp-8e1c4c6b",
    "lineId": "3",
    "aiDecision": "PASS",
    "createdAt": "2026-01-03T13:41:31Z"
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
    "externalInspectionId": "insp-8e1c4c6b",
    "lineId": "3",
    "modelId": "44613b0a-ea4c-4cdb-889f-fbb337059c0e",
    "modelName": "pcb_1",
    "aiDecision": "PASS",
    "aiTimestamp": "2026-01-03T13:41:31Z",
    "aiImageUrlTop": "http://localhost:8001/static/images/xxx.png",
    "aiImageUrlBottom": null,
    "aiObjectsTop": [...],
    "aiObjectsBottom": [],
    "operatorDecision": "GOOD",
    "operatorTimestamp": "2026-01-03T13:41:45Z",
    "isFalseCall": false,
    "falseCallImageUrl": null,
    "workOrderId": "uuid-xxx",
    "createdAt": "2026-01-03T13:41:31Z",
    "updatedAt": "2026-01-03T13:41:45Z"
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

---

#### 1.4 Update Inspection

**PATCH** `/api/ai/inspections/{external_inspection_id}`

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

---

#### 2.2 Create Model

**POST** `/api/ai/models`

---

#### 2.3 Get Model

**GET** `/api/ai/models/{id}`

---

#### 2.4 Update Model

**PATCH** `/api/ai/models/{id}`

---

#### 2.5 Delete Model

**DELETE** `/api/ai/models/{id}`

---

### 3. Boards

**NEW** — Read-only access to board definitions.

#### 3.1 List Boards

**GET** `/api/ai/boards`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `customer_id` | string | Filter by customer |
| `part_number` | string | Search by part number (partial match) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "board-001",
      "name": "Main Controller PCB",
      "partNumber": "PCB-MC-2024-001",
      "customerId": "cust-001",
      "customer": {
        "id": "cust-001",
        "name": "Acme Corp",
        "code": "ACME"
      },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20
  }
}
```

---

#### 3.2 Get Board by ID or Part Number

**GET** `/api/ai/boards/{id}`

The `{id}` parameter can be:
- Board ID (UUID format)
- Part number (string)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "board-001",
    "name": "Main Controller PCB",
    "partNumber": "PCB-MC-2024-001",
    "customerId": "cust-001",
    "customer": {
      "id": "cust-001",
      "name": "Acme Corp",
      "code": "ACME"
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
}
```

---

### 4. Lines

**NEW** — Line configuration with AI model assignment.

#### 4.1 List Lines

**GET** `/api/ai/lines`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `section_id` | string | Filter by section |
| `customer_id` | string | Filter by customer |
| `has_model` | boolean | Filter lines with/without model assigned |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "line-001",
      "name": "SMT-01",
      "sectionId": "sect-001",
      "customerId": "cust-001",
      "aiModelId": "model-uuid",
      "cameraConfig": {
        "top": { "resolution": "4096x3072", "exposure": 100 },
        "bottom": { "resolution": "4096x3072", "exposure": 120 }
      },
      "inspectionParams": {
        "confidenceThreshold": 0.85,
        "autoPassThreshold": 0.95
      },
      "section": { "id": "sect-001", "name": "SMT Area" },
      "customer": { "id": "cust-001", "name": "Acme Corp", "code": "ACME" },
      "aiModel": {
        "id": "model-uuid",
        "name": "pcb_1",
        "version": "1.0.0",
        "status": "active"
      },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

---

#### 4.2 Get Line by ID

**GET** `/api/ai/lines/{id}`

Returns full line configuration including model details.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "line-001",
    "name": "SMT-01",
    "sectionId": "sect-001",
    "customerId": "cust-001",
    "aiModelId": "model-uuid",
    "cameraConfig": {
      "top": { "resolution": "4096x3072", "exposure": 100 },
      "bottom": { "resolution": "4096x3072", "exposure": 120 }
    },
    "inspectionParams": {
      "confidenceThreshold": 0.85,
      "autoPassThreshold": 0.95
    },
    "section": { "id": "sect-001", "name": "SMT Area" },
    "customer": { "id": "cust-001", "name": "Acme Corp", "code": "ACME" },
    "aiModel": {
      "id": "model-uuid",
      "name": "pcb_1",
      "version": "1.0.0",
      "status": "active",
      "filePath": "/models/pcb_1_v1.0.0.pt",
      "config": {
        "threshold": 0.85,
        "classes": ["target-d", "target-u", "solder_bridge"]
      }
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
}
```

---

#### 4.3 Update Line Configuration

**PATCH** `/api/ai/lines/{id}`

Update AI model assignment or configuration.

**Request Body:**

```json
{
  "aiModelId": "new-model-uuid",
  "cameraConfig": {
    "top": { "resolution": "4096x3072", "exposure": 110 }
  },
  "inspectionParams": {
    "confidenceThreshold": 0.90
  }
}
```

**Response:** Returns updated line data.

---

### 5. Dataset Images

Manage images for training datasets.

#### 5.1 List Dataset Images

**GET** `/api/ai/dataset-images`

---

#### 5.2 Create Dataset Image

**POST** `/api/ai/dataset-images`

---

#### 5.3 Get Dataset Image

**GET** `/api/ai/dataset-images/{id}`

---

#### 5.4 Update Dataset Image

**PATCH** `/api/ai/dataset-images/{id}`

---

#### 5.5 Delete Dataset Image

**DELETE** `/api/ai/dataset-images/{id}`

---

#### 5.6 Bulk Create Dataset Images

**POST** `/api/ai/dataset-images/bulk`

---

### 6. Training Datasets

Manage training dataset collections.

#### 6.1 List Training Datasets

**GET** `/api/ai/training-datasets`

---

#### 6.2 Create Training Dataset

**POST** `/api/ai/training-datasets`

---

#### 6.3 Get Training Dataset

**GET** `/api/ai/training-datasets/{id}`

---

#### 6.4 Update Training Dataset

**PATCH** `/api/ai/training-datasets/{id}`

---

#### 6.5 Delete Training Dataset

**DELETE** `/api/ai/training-datasets/{id}`

---

#### 6.6 Add Images to Dataset

**POST** `/api/ai/training-datasets/{id}/images`

---

#### 6.7 Remove Images from Dataset

**DELETE** `/api/ai/training-datasets/{id}/images`

---

### 7. Training Jobs

Manage AI model training jobs.

_(Deferred to next phase)_

---

### 8. Training Metrics

Log detailed training metrics per epoch.

_(Deferred to next phase)_

---

### 9. Sample Images

Manage sample/reference images for testing.

#### 9.1 List Sample Images

**GET** `/api/ai/sample-images`

---

#### 9.2 Create Sample Image

**POST** `/api/ai/sample-images`

---

#### 9.3 Delete Sample Image

**DELETE** `/api/ai/sample-images/{id}`

---

### 10. Defect Classes

Reference data for defect types (read-only for AI Backend).

#### 10.1 List Defect Classes

**GET** `/api/ai/defect-classes`

---

#### 10.2 Get Defect Class

**GET** `/api/ai/defect-classes/{id}`

---

### 11. False Call Reasons

Reference data for false call categorization (read-only).

#### 11.1 List False Call Reasons

**GET** `/api/ai/false-call-reasons`

---

### 12. System Status

Hardware status updates from AI Backend.

#### 12.1 Get System Status

**GET** `/api/ai/system-status`

---

#### 12.2 Update System Status

**POST** `/api/ai/system-status`

---

## Image Storage

### Image Flow Architecture

```
                            LIVE INSPECTION
┌─────────────────┐                              ┌─────────────────┐
│   AI Backend    │ ──── SSE (image URLs) ─────▶│   UI (Next.js)  │
│                 │                              │                 │
│ /static/images/ │ ◀── HTTP GET (fetch image)──│   <img src=...> │
│ /static/crops/  │                              │                 │
└─────────────────┘                              └─────────────────┘

                            FALSE CALL FLOW
┌─────────────────┐                              ┌─────────────────┐
│   UI (Next.js)  │ ──── Upload false call ────▶│    Supabase     │
│                 │      annotated image         │    Storage      │
│ Annotate defect │                              │                 │
│ Submit as PNG   │                              │ inspection-imgs │
└─────────────────┘                              └─────────────────┘
```

### AI Backend Image Serving

AI Backend stores and serves images via HTTP:

| URL Pattern | Content |
|-------------|---------|
| `http://localhost:8001/static/images/{filename}` | Full board images |
| `http://localhost:8001/static/crops/{filename}` | Cropped defect images |
| `http://localhost:8001/static/thumbs/{filename}` | Thumbnails |

### False Call Image Upload

When operator marks a false call, UI:
1. Captures the annotated image
2. Uploads to Supabase Storage bucket `inspection-images`
3. Stores the public URL in `inspection_results.false_call_image_url`

**Storage Path:**
```
inspection-images/
  {year}/
    {month}/
      {day}/
        {line_id}/
          {inspection_id}_annotated.png
```

---

## Work Order Integration

### Counter Update Flow

When operator confirms inspection (GOOD/NG):

```
┌─────────────────┐     POST /confirm      ┌─────────────────┐
│   UI (Next.js)  │ ──────────────────────▶│   AI Backend    │
│                 │                         │                 │
│ Updates:        │                         │ Triggers:       │
│ • completed_qty │                         │ • PLC signal    │
│ • good_qty      │                         │ • Reject/Pass   │
│ • ng_qty        │                         │                 │
│ • yield %       │                         │                 │
└────────┬────────┘                         └─────────────────┘
         │
         │ PATCH /api/work-orders/{id}
         ▼
┌─────────────────┐
│   Local DB      │
│   work_orders   │
│                 │
│ completed_qty++ │
│ good/ng_qty++   │
│ yield = calc    │
└─────────────────┘
```

### Work Order Fields Updated

| Field | Updated When |
|-------|--------------|
| `completed_qty` | Every inspection |
| `good_qty` | Operator clicks GOOD |
| `ng_qty` | Operator clicks NG |
| `false_call_qty` | When `isFalseCall = true` |
| `yield` | Auto-calculated: `good_qty / completed_qty * 100` |

### Status Transitions

```
READY → IN_PROGRESS (first inspection)
IN_PROGRESS → COMPLETED (completed_qty >= lot_size)
```

---

## SSE Events Reference

AI Backend sends these SSE events to UI.

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
      { "id": "cam-01", "name": "Top Camera", "status": "ONLINE" },
      { "id": "cam-02", "name": "Bottom Camera", "status": "OFFLINE", "message": "Connection timeout" }
    ],
    "plcs": [
      { "id": "plc-01", "name": "Conveyor PLC", "status": "ONLINE" }
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
  "completed": false
}
```

---

## Webhook Callbacks

_(Optional — for future implementation)_

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-07 | Added Boards, Lines endpoints; Updated architecture diagram; Added Image Storage section; Added Work Order integration |
| 1.0.0 | 2026-01-04 | Initial API contract |

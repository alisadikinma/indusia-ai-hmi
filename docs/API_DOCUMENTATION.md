# INDUSIA AI HMI - API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000/api`  
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Codes](#error-codes)
5. [API Endpoints](#api-endpoints)
   - [Auth](#auth)
   - [Users](#users)
   - [Roles & Permissions](#roles--permissions)
   - [Master Data](#master-data)
   - [Work Orders](#work-orders)
   - [Inspections](#inspections)
   - [Overrides](#overrides)
   - [Models](#models)
   - [Dashboard](#dashboard)
   - [Notifications](#notifications)
   - [System](#system)

---

## Overview

INDUSIA AI HMI API menyediakan akses programatik ke sistem inspeksi visual PCB berbasis AI. API ini menggunakan REST architecture dengan JSON sebagai format data.

### Key Features
- Role-based access control (RBAC)
- Section-based data isolation
- Real-time inspection data
- AI model management
- Training pipeline integration

---

## Authentication

### Cookie-based Session

API menggunakan cookie-based session authentication. Login melalui `/api/auth/login` akan mengset session cookie.

### Headers

```http
Content-Type: application/json
Cookie: session=<session_token>
```

### Permission Format

Permission menggunakan format `resource:action`:
- `users:read` - Read user data
- `work-orders:create` - Create work orders
- `overrides:review` - Review overrides
- `models:deploy` - Deploy AI models

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "count": 100,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "code": "VALIDATION_ERROR"
}
```

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Not logged in |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## API Endpoints

---

# Auth

## POST /api/auth/login

Login user dan create session.

**Request Body:**
```json
{
  "email": "operator@indusia.ai",
  "password": "operator123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Operator User",
      "email": "operator@indusia.ai",
      "role": "operator",
      "role_id": "role_operator",
      "status": "active",
      "sections": ["section_smt"]
    }
  }
}
```

**Error Responses:**
- `400` - Email and password required
- `401` - Invalid email or password
- `403` - Account is not active

---

## POST /api/auth/logout

Logout user dan clear session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## GET /api/auth/me

Get current authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Operator User",
      "email": "operator@indusia.ai",
      "role": "operator",
      "status": "active"
    }
  }
}
```

---

## POST /api/auth/change-password

Change user password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

# Users

## GET /api/users

List all users. **Permission:** `users:read`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status (active, inactive) |
| role_id | string | Filter by role |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@indusia.ai",
      "role_id": "role_operator",
      "status": "active",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "count": 50
}
```

---

## POST /api/users

Create new user. **Permission:** `users:create`

**Request Body:**
```json
{
  "name": "New User",
  "email": "newuser@indusia.ai",
  "password": "password123",
  "role_id": "role_operator",
  "sections": ["section_smt"],
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New User",
    "email": "newuser@indusia.ai"
  }
}
```

---

## GET /api/users/[id]

Get user by ID. **Permission:** `users:read`

---

## PUT /api/users/[id]

Update user. **Permission:** `users:update`

---

## DELETE /api/users/[id]

Delete user. **Permission:** `users:delete`

---

# Roles & Permissions

## GET /api/roles

List all roles. **Permission:** `roles:read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role_operator",
      "name": "Operator",
      "description": "Factory floor operator"
    },
    {
      "id": "role_manager",
      "name": "Manager",
      "description": "Production manager"
    }
  ]
}
```

---

## GET /api/permissions/[roleId]

Get permissions for role.

**Response:**
```json
{
  "success": true,
  "data": {
    "role_id": "role_operator",
    "permissions": [
      "inspection:read",
      "overrides:create",
      "work-orders:read"
    ]
  }
}
```

---

# Master Data

## GET /api/master-data/customers

List all customers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cust_001",
      "name": "ACME Electronics",
      "code": "ACME",
      "status": "active"
    }
  ]
}
```

---

## GET /api/master-data/sections

List all sections (production areas).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "section_smt",
      "name": "SMT Line",
      "code": "SMT"
    },
    {
      "id": "section_tht",
      "name": "THT Line",
      "code": "THT"
    }
  ]
}
```

---

## GET /api/master-data/lines

List all production lines.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| sectionId | string | Filter by section |
| status | string | Filter by status |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "line-demo-001",
      "name": "SMT Line 1",
      "section_id": "section_smt",
      "status": "active"
    }
  ]
}
```

---

## GET /api/master-data/lines/[id]

Get line details.

---

## GET /api/master-data/boards

List all board definitions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "board_001",
      "part_number": "PCB-2024-001",
      "description": "Main Controller Board",
      "side_count": 2,
      "customer_id": "cust_001"
    }
  ]
}
```

---

## GET /api/master-data/menu-items

Get menu structure for navigation.

---

# Work Orders

## GET /api/work-orders

List work orders. **Permission:** `work-orders:read`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | pending, in_progress, completed, cancelled |
| lineId | string | Filter by line |
| sectionId | string | Filter by section |
| customerId | string | Filter by customer |
| dateFrom | string | Start date (ISO format) |
| dateTo | string | End date (ISO format) |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |
| orderBy | string | Sort field (default: created_at) |
| orderDirection | string | asc or desc |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "wo_number": "WO-2026-001",
      "line_id": "line-demo-001",
      "board_id": "board_001",
      "lot_size": 500,
      "completed_qty": 250,
      "good_qty": 245,
      "ng_qty": 5,
      "status": "in_progress",
      "side_count": 2,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "count": 10
}
```

---

## POST /api/work-orders

Create work order. **Permission:** `work-orders:create`

**Request Body:**
```json
{
  "lineId": "line-demo-001",
  "boardId": "board_001",
  "customerId": "cust_001",
  "sectionId": "section_smt",
  "lotSize": 500,
  "sideCount": 2,
  "scheduledDate": "2026-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "wo_number": "WO-2026-002"
  }
}
```

---

## GET /api/work-orders/[id]

Get work order details.

---

## PUT /api/work-orders/[id]

Update work order.

---

## POST /api/work-orders/[id]/start

Start work order (set status to in_progress).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "in_progress",
    "started_at": "2026-01-01T08:00:00Z"
  }
}
```

---

## POST /api/work-orders/[id]/complete

Complete work order.

---

## PATCH /api/work-orders/[id]/counters

Update work order counters (increment quantities).

**Request Body:**
```json
{
  "goodQty": 1,
  "ngQty": 0,
  "completedQty": 1,
  "falseCallQty": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "good_qty": 246,
    "ng_qty": 5,
    "completed_qty": 251
  }
}
```

---

## GET /api/work-orders/active/[lineId]

Get active work order for line.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "wo_number": "WO-2026-001",
    "lot_size": 500,
    "completed_qty": 250,
    "good_qty": 245,
    "ng_qty": 5,
    "side_count": 2,
    "status": "in_progress"
  }
}
```

---

# Inspections

## GET /api/inspections

List inspections.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| lineId | string | Filter by line |
| sectionId | string | Filter by section |
| customerId | string | Filter by customer |
| aiResult | string | GOOD, NG |
| operatorDecision | string | APPROVE, FALSE_CALL, MISSED_DEFECT |
| operatorId | string | Filter by operator |
| boardId | string | Filter by board ID |
| dateFrom | string | Start date |
| dateTo | string | End date |
| limit | number | Max results |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "board_id": "WO-2026-001-0001",
      "work_order_id": "uuid",
      "line_id": "line-demo-001",
      "side": "TOP",
      "ai_result": "NG",
      "ai_confidence": 0.94,
      "operator_decision": "APPROVE",
      "defect_count": 1,
      "cycle_time_ms": 3500,
      "inspection_timestamp": "2026-01-01T08:30:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 500
  }
}
```

---

## POST /api/inspections

Create inspection record.

**Request Body:**
```json
{
  "boardId": "WO-2026-001-0001",
  "workOrderId": "uuid",
  "lineId": "line-demo-001",
  "sectionId": "section_smt",
  "customerId": "cust_001",
  "side": "TOP",
  "boardSequence": 1,
  "aiResult": "NG",
  "aiConfidence": 0.94,
  "operatorDecision": "APPROVE",
  "operatorId": "uuid",
  "plcSignalSent": "NG",
  "cycleTimeMs": 3500,
  "shift": "day",
  "defects": [
    {
      "defectType": "solder_bridge",
      "severity": "critical",
      "confidence": 0.94,
      "bbox": { "x": 280, "y": 180, "width": 80, "height": 60 },
      "componentRef": "U15",
      "operatorDisposition": "TRUE_DEFECT"
    }
  ],
  "defectCount": 1
}
```

---

## GET /api/inspections/[id]

Get inspection details.

---

## GET /api/inspections/stats

Get inspection statistics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| lineId | string | Filter by line |
| shift | string | day, swing, night |
| date | string | Date (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 500,
    "good": 480,
    "ng": 20,
    "yield": 96.0,
    "falseCallRate": 5.0,
    "avgCycleTime": 3200
  }
}
```

---

## GET /api/inspection/stats/[lineId]

Get real-time stats for line.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| shift | string | Shift filter |
| date | string | Date filter |

---

## POST /api/inspection/save-crop

Save cropped defect image.

**Request Body:**
```json
{
  "imageData": "data:image/png;base64,...",
  "boardId": "WO-2026-001-0001",
  "defectIndex": 0,
  "defectType": "solder_bridge",
  "side": "TOP",
  "woNumber": "WO-2026-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filePath": "/crops/WO-2026-001/2026-01-03/...",
    "fullPath": "C:\\xampp\\htdocs\\...",
    "filename": "WO-2026-001-0001_TOP_0_solder_bridge.png"
  }
}
```

---

## GET /api/inspections/defect-classes

Get available defect classes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "solder_bridge",
      "name": "Solder Bridge",
      "severity": "critical",
      "ipc_reference": "IPC-A-610 8.2.9"
    },
    {
      "id": "insufficient_solder",
      "name": "Insufficient Solder",
      "severity": "major"
    }
  ]
}
```

---

## GET /api/inspections/false-call-reasons

Get false call reason codes.

**Response:**
```json
{
  "success": true,
  "data": [
    { "code": "REFLECTION", "label": "Reflection/Lighting" },
    { "code": "ACCEPTABLE_VARIATION", "label": "Acceptable Variation" },
    { "code": "WRONG_CLASSIFICATION", "label": "Wrong Classification" },
    { "code": "NORMAL_SOLDER", "label": "Normal Solder Joint" }
  ]
}
```

---

# Overrides

## GET /api/overrides

List overrides. **Permission:** `overrides:read`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | pending, approved, rejected |
| section_id | string | Filter by section |
| customer_id | string | Filter by customer |
| from | string | Start date |
| to | string | End date |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "board_id": "WO-2026-001-0001",
      "override_type": "false_positive",
      "defect_type": "solder_bridge",
      "reason": "REFLECTION",
      "status": "pending",
      "submitted_by": "uuid",
      "submitted_by_name": "Operator User",
      "created_at": "2026-01-01T08:30:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

## POST /api/overrides

Create override request. **Permission:** `overrides:create`

**Request Body (Simple):**
```json
{
  "board_id": "WO-2026-001-0001",
  "defect_type": "solder_bridge",
  "reason": "REFLECTION",
  "operator_notes": "Light reflection causing false detection",
  "section_id": "section_smt",
  "customer_id": "cust_001"
}
```

**Request Body (With Annotations):**
```json
{
  "board_id": "WO-2026-001-0001",
  "section_id": "section_smt",
  "line_id": "line-demo-001",
  "override_type": "false_positive",
  "reason": "REFLECTION",
  "images": [
    {
      "image_url": "/images/inspection/...",
      "ai_detections": [
        { "x": 100, "y": 100, "width": 50, "height": 50, "class": "solder_bridge" }
      ],
      "annotations": [
        { "x": 100, "y": 100, "width": 50, "height": 50, "label": "not_defect" }
      ]
    }
  ]
}
```

---

## GET /api/overrides/[id]

Get override details.

---

## PUT /api/overrides/[id]

Update override (review). **Permission:** `overrides:review`

**Request Body:**
```json
{
  "status": "approved",
  "reviewer_notes": "Confirmed false positive",
  "reviewed_by": "uuid"
}
```

---

## GET /api/overrides/stats

Get override statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 25,
    "approved": 110,
    "rejected": 15,
    "byType": {
      "false_positive": 100,
      "missed_defect": 50
    }
  }
}
```

---

# Models

## GET /api/models

List AI models. **Permission:** `models:read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Solder Defect v2.1",
      "version": "2.1.0",
      "status": "active",
      "accuracy": 0.97,
      "f1_score": 0.95,
      "deployed_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

## POST /api/models

Upload new model. **Permission:** `models:create`

---

## GET /api/models/[id]

Get model details.

---

## POST /api/models/[id]/deploy

Deploy model to production. **Permission:** `models:deploy`

**Request Body:**
```json
{
  "lines": ["line-demo-001", "line-demo-002"],
  "deployNotes": "Improved detection for solder bridges"
}
```

---

## GET /api/models/[id]/download

Download model file.

---

## GET /api/models/active

Get currently active model.

---

## GET /api/models/history

Get model deployment history.

---

# Dashboard

## GET /api/dashboard/summary

Get dashboard summary stats.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| dateFrom | string | Start date |
| dateTo | string | End date |
| lineId | string | Filter by line |
| sectionId | string | Filter by section |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInspections": 5000,
    "passRate": 96.5,
    "defectRate": 3.5,
    "falseCallRate": 4.2,
    "avgCycleTime": 3200,
    "topDefects": [
      { "type": "solder_bridge", "count": 85 },
      { "type": "insufficient_solder", "count": 45 }
    ]
  }
}
```

---

## GET /api/dashboard/trend

Get trend data for charts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| metric | string | yield, defect_rate, false_call_rate |
| period | string | hourly, daily, weekly |
| dateFrom | string | Start date |
| dateTo | string | End date |

**Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-01-01", "value": 96.5 },
    { "date": "2026-01-02", "value": 97.2 }
  ]
}
```

---

## GET /api/dashboard/pareto

Get Pareto chart data (top defects).

**Response:**
```json
{
  "success": true,
  "data": [
    { "defect": "Solder Bridge", "count": 85, "cumulative": 35.4 },
    { "defect": "Insufficient Solder", "count": 45, "cumulative": 54.2 }
  ]
}
```

---

## GET /api/dashboard/heatmap

Get defect heatmap data.

**Response:**
```json
{
  "success": true,
  "data": {
    "width": 1024,
    "height": 768,
    "points": [
      { "x": 280, "y": 180, "intensity": 15 },
      { "x": 450, "y": 320, "intensity": 8 }
    ]
  }
}
```

---

# Notifications

## GET /api/notifications

Get user notifications.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| unread | boolean | Filter unread only |
| limit | number | Max results |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "override_approved",
      "title": "Override Approved",
      "message": "Your override request was approved",
      "read": false,
      "created_at": "2026-01-01T08:30:00Z"
    }
  ]
}
```

---

## PATCH /api/notifications

Mark notifications as read.

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "read": true
}
```

---

## GET /api/notifications/unread-count

Get unread notification count.

**Response:**
```json
{
  "success": true,
  "data": { "count": 5 }
}
```

---

# System

## GET /api/system-health

Get system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "aiModel": { "status": "ok", "latency": 45 },
    "camera": { "status": "ok" },
    "database": { "status": "ok", "latency": 12 },
    "cloud": { "status": "ok" },
    "lastSync": "2026-01-01T08:30:00Z"
  }
}
```

---

## POST /api/plc/signal

Send PLC signal (internal use).

**Request Body:**
```json
{
  "lineId": "line-demo-001",
  "signal": "GOOD",
  "boardId": "WO-2026-001-0001",
  "operatorId": "uuid"
}
```

---

## GET /api/live/[lineId]

Get live inspection data for line.

**Response:**
```json
{
  "success": true,
  "data": {
    "lineId": "line-demo-001",
    "status": "running",
    "currentBoard": "WO-2026-001-0025",
    "lastResult": "GOOD",
    "stats": {
      "inspected": 25,
      "good": 24,
      "ng": 1
    }
  }
}
```

---

## GET /api/event-log

Get system event log.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| type | string | Event type filter |
| userId | string | Filter by user |
| limit | number | Max results |

---

## POST /api/error-log

Log error (internal use).

---

# Sync Queue (Training Pipeline)

## GET /api/sync-queue

List items in training sync queue.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "inspection_id": "uuid",
      "board_id": "WO-2026-001-0001",
      "record_type": "false_call",
      "status": "pending",
      "created_at": "2026-01-01T08:30:00Z"
    }
  ]
}
```

---

## POST /api/sync-queue

Add item to sync queue.

**Request Body:**
```json
{
  "inspectionId": "uuid",
  "boardId": "WO-2026-001-0001",
  "lineName": "SMT Line 1",
  "defectType": "solder_bridge",
  "defectCount": 1,
  "localImagePath": "/images/...",
  "recordType": "false_call"
}
```

---

## GET /api/sync-queue/summary

Get sync queue summary.

---

## POST /api/sync-queue/sync

Trigger sync to cloud training.

---

## GET /api/sync-queue/history

Get sync history.

---

# Dataset Queue

## GET /api/dataset-queue

List dataset queue items.

---

## POST /api/dataset-queue

Add to dataset queue.

---

# Defect Classes

## GET /api/defect-classes

List all defect class definitions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "solder_bridge",
      "name": "Solder Bridge",
      "description": "Unwanted solder connection between two conductors",
      "severity": "critical",
      "ipc_class": "1,2,3",
      "ipc_reference": "IPC-A-610 8.2.9"
    }
  ]
}
```

---

# Images

## POST /api/images/upload

Upload inspection image.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | Image file (PNG, JPG) |
| boardId | string | Board ID |
| side | string | TOP or BOTTOM |

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "/images/uploads/...",
    "filename": "...",
    "size": 1024000
  }
}
```

---

## GET /api/images/[overrideId]

Get images for override.

---

# Session Management

## GET /api/inspection/session

Get current inspection session.

---

## POST /api/inspection/session

Create/start inspection session.

---

## PATCH /api/inspection/session/[id]

Update session (pause, resume, end).

---

# Appendix

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@indusia.ai | admin123 |
| Manager | manager@indusia.ai | manager123 |
| Engineer | engineer@indusia.ai | engineer123 |
| Operator | operator@indusia.ai | operator123 |

## Role Permissions

| Role | Permissions |
|------|-------------|
| Operator | inspection:*, overrides:create, work-orders:read |
| Manager | + overrides:review, reports:*, dashboard:* |
| Engineer | + master-data:*, models:*, training:* |
| Super Admin | Full access |

## Rate Limits

- Standard: 100 requests/minute
- Upload: 10 requests/minute
- Heavy queries: 20 requests/minute

---

*Last updated: January 2026*

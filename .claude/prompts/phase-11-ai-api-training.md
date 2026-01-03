# Phase 11: AI Backend API Endpoints (Part 2 - Training Pipeline)

## Objective
Implement training pipeline API endpoints: datasets, jobs, metrics.

> This phase covers ~22 endpoints for the training pipeline.

---

## Context

Training pipeline membutuhkan API untuk:
- Dataset management (images, collections)
- Training job lifecycle (create, run, cancel)
- Metrics logging (per-epoch training metrics)

---

## Task 1: Dataset Images API (6 endpoints)

### 1.1 `app/api/ai/dataset-images/route.js`

```javascript
/**
 * Dataset Images API
 * GET: List images with filters
 * POST: Create single image record
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { datasetImagesRepo } from '@/lib/repos/datasetImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createImageSchema = z.object({
  file_path: z.string(),
  file_name: z.string(),
  source: z.enum(['upload', 'inspection', 'augmented']).default('upload'),
  annotations: z.array(z.any()).optional(),
  is_labeled: z.boolean().default(false),
  metadata: z.object({}).passthrough().optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      datasetId: searchParams.get('dataset_id'),
      source: searchParams.get('source'),
      isLabeled: searchParams.get('is_labeled') === 'true' ? true :
                 searchParams.get('is_labeled') === 'false' ? false : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await datasetImagesRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/dataset-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createImageSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await datasetImagesRepo.create(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/dataset-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)
```

### 1.2 `app/api/ai/dataset-images/[id]/route.js`

Implement GET, PATCH, DELETE for single image.

### 1.3 `app/api/ai/dataset-images/bulk/route.js`

Implement POST for bulk image creation.

---

## Task 2: Training Datasets API (7 endpoints)

### 2.1 `app/api/ai/training-datasets/route.js`

GET (list), POST (create)

### 2.2 `app/api/ai/training-datasets/[id]/route.js`

GET, PATCH, DELETE for single dataset.

### 2.3 `app/api/ai/training-datasets/[id]/images/route.js`

POST (add images), DELETE (remove images)

---

## Task 3: Training Jobs API (5 endpoints)

### 3.1 `app/api/ai/training-jobs/route.js`

```javascript
/**
 * Training Jobs API
 * GET: List jobs
 * POST: Create new job
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingJobsRepo } from '@/lib/repos/trainingJobsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createJobSchema = z.object({
  name: z.string().min(1).max(100),
  dataset_id: z.string().uuid(),
  base_model_id: z.string().uuid().optional(),
  config: z.object({
    epochs: z.number().int().min(1).max(1000).default(100),
    batch_size: z.number().int().min(1).max(256).default(16),
    learning_rate: z.number().positive().default(0.001),
    optimizer: z.string().default('adam'),
    image_size: z.number().int().default(640)
  }).passthrough()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      status: searchParams.get('status'),
      datasetId: searchParams.get('dataset_id'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await trainingJobsRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/training-jobs error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createJobSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await trainingJobsRepo.create(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/training-jobs error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)
```

### 3.2 `app/api/ai/training-jobs/[id]/route.js`

GET (status), PATCH (update progress)

### 3.3 `app/api/ai/training-jobs/[id]/cancel/route.js`

POST (cancel running job)

---

## Task 4: Training Metrics API (3 endpoints)

### 4.1 `app/api/ai/training-metrics/route.js`

GET (list by job_id), POST (log single)

### 4.2 `app/api/ai/training-metrics/bulk/route.js`

POST (bulk log multiple epochs)

---

## Task 5: Sample Images API (3 endpoints)

### 5.1 `app/api/ai/sample-images/route.js`

GET (list), POST (create)

### 5.2 `app/api/ai/sample-images/[id]/route.js`

DELETE (remove sample)

---

## Verification Checklist

### Dataset Images
- [ ] `GET /api/ai/dataset-images` — list with filters
- [ ] `POST /api/ai/dataset-images` — create image
- [ ] `GET /api/ai/dataset-images/[id]` — get by ID
- [ ] `PATCH /api/ai/dataset-images/[id]` — update annotations
- [ ] `DELETE /api/ai/dataset-images/[id]` — delete
- [ ] `POST /api/ai/dataset-images/bulk` — bulk create

### Training Datasets
- [ ] `GET /api/ai/training-datasets` — list
- [ ] `POST /api/ai/training-datasets` — create
- [ ] `GET /api/ai/training-datasets/[id]` — get details
- [ ] `PATCH /api/ai/training-datasets/[id]` — update
- [ ] `DELETE /api/ai/training-datasets/[id]` — delete
- [ ] `POST /api/ai/training-datasets/[id]/images` — add images
- [ ] `DELETE /api/ai/training-datasets/[id]/images` — remove images

### Training Jobs
- [ ] `GET /api/ai/training-jobs` — list
- [ ] `POST /api/ai/training-jobs` — create
- [ ] `GET /api/ai/training-jobs/[id]` — get status
- [ ] `PATCH /api/ai/training-jobs/[id]` — update progress
- [ ] `POST /api/ai/training-jobs/[id]/cancel` — cancel

### Training Metrics
- [ ] `GET /api/ai/training-metrics` — list by job
- [ ] `POST /api/ai/training-metrics` — log single
- [ ] `POST /api/ai/training-metrics/bulk` — bulk log

### Sample Images
- [ ] `GET /api/ai/sample-images` — list
- [ ] `POST /api/ai/sample-images` — create
- [ ] `DELETE /api/ai/sample-images/[id]` — delete

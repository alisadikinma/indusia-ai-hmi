# Phase 9: AI Backend API Endpoints (Part 1 - Core)

## Objective
Implement core AI Backend API endpoints: inspections, models, system-status.

> This phase covers ~11 endpoints. Part 2 (Phase 11) covers training pipeline endpoints.

---

## Task 1: Inspections API

### 1.1 `app/api/ai/inspections/route.js`

```javascript
/**
 * AI Inspections API
 * POST: Create inspection from AI detection
 * GET: List inspections with filters
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, validationErrorResponse, paginatedResponse } from '@/lib/utils/apiResponse'
import { inspectionRepo } from '@/lib/repos/inspectionRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createInspectionSchema = z.object({
  external_inspection_id: z.string().min(1),
  line_id: z.string(),
  model_id: z.string().uuid().optional(),
  model_name: z.string().optional(),
  ai_decision: z.enum(['PASS', 'FAIL']),
  ai_timestamp: z.string().datetime(),
  results: z.object({
    top: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }),
    bottom: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }).optional()
  })
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createInspectionSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const data = validation.data

    // Transform to database format
    const inspectionData = {
      externalInspectionId: data.external_inspection_id,
      lineId: data.line_id,
      modelId: data.model_id,
      modelName: data.model_name,
      aiDecision: data.ai_decision,
      aiTimestamp: data.ai_timestamp,
      aiImageUrlTop: data.results.top?.image_url,
      aiImageUrlBottom: data.results.bottom?.image_url,
      aiObjectsTop: data.results.top?.objects || [],
      aiObjectsBottom: data.results.bottom?.objects || []
    }

    const result = await inspectionRepo.createFromAi(inspectionData)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      lineId: searchParams.get('line_id'),
      aiDecision: searchParams.get('ai_decision'),
      isFalseCall: searchParams.get('is_false_call') === 'true' ? true :
                   searchParams.get('is_false_call') === 'false' ? false : undefined,
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await inspectionRepo.listForAi(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)
export const GET = withApiKeyAuth(handleGET)
```

### 1.2 `app/api/ai/inspections/[id]/route.js`

```javascript
/**
 * AI Inspection by External ID
 * GET: Get inspection details
 * PATCH: Update AI-side data
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse } from '@/lib/utils/apiResponse'
import { inspectionRepo } from '@/lib/repos/inspectionRepo'

async function handleGET(request, { params }) {
  try {
    const { id } = params

    const result = await inspectionRepo.getByExternalId(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Inspection')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/inspections/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    // Only allow AI-side fields to be updated
    const allowedFields = ['ai_decision', 'ai_objects_top', 'ai_objects_bottom']
    const updates = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const result = await inspectionRepo.updateByExternalId(id, updates)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/inspections/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
```

---

## Task 2: Models API

### 2.1 `app/api/ai/models/route.js`

```javascript
/**
 * AI Models API
 * GET: List models
 * POST: Register new model
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { aiModelsRepo } from '@/lib/repos/aiModelsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'training', 'deprecated']).default('inactive'),
  file_path: z.string().optional(),
  config: z.object({}).passthrough().optional(),
  metrics: z.object({}).passthrough().optional(),
  training_job_id: z.string().uuid().optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      status: searchParams.get('status'),
      name: searchParams.get('name'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    }

    const result = await aiModelsRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/models error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createModelSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await aiModelsRepo.create(validation.data)

    if (!result.success) {
      if (result.code === 'DUPLICATE') {
        return NextResponse.json({
          success: false,
          error: result.error,
          code: 'DUPLICATE_ENTRY'
        }, { status: 409 })
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/models error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)
```

### 2.2 `app/api/ai/models/[id]/route.js`

```javascript
/**
 * AI Model by ID
 * GET: Get model details
 * PATCH: Update model
 * DELETE: Delete model
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse } from '@/lib/utils/apiResponse'
import { aiModelsRepo } from '@/lib/repos/aiModelsRepo'

async function handleGET(request, { params }) {
  try {
    const result = await aiModelsRepo.getById(params.id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Model')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const body = await request.json()
    const result = await aiModelsRepo.update(params.id, body)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const result = await aiModelsRepo.delete(params.id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ message: 'Model deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
export const DELETE = withApiKeyAuth(handleDELETE)
```

---

## Task 3: System Status API

### 3.1 `app/api/ai/system-status/route.js`

```javascript
/**
 * System Status API
 * GET: Get current system status
 * POST: Update component status
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('system_status')
      .select('*')
      .order('component')

    if (error) throw error

    // Group by component type
    const grouped = {
      ai_model: null,
      cameras: [],
      plcs: [],
      last_updated: null
    }

    for (const row of data) {
      if (row.component === 'ai_model') {
        grouped.ai_model = {
          status: row.status,
          ...row.metadata
        }
      } else if (row.component === 'camera') {
        grouped.cameras.push({
          id: row.component_id,
          name: row.metadata?.name || row.component_id,
          status: row.status,
          message: row.message
        })
      } else if (row.component === 'plc') {
        grouped.plcs.push({
          id: row.component_id,
          name: row.metadata?.name || row.component_id,
          status: row.status,
          message: row.message
        })
      }

      if (!grouped.last_updated || row.updated_at > grouped.last_updated) {
        grouped.last_updated = row.updated_at
      }
    }

    return successResponse(grouped)
  } catch (error) {
    console.error('GET /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()

    // Handle batch updates
    const updates = body.updates || [body]

    for (const update of updates) {
      const { component, component_id, status, message, metadata } = update

      const key = component_id ? `${component}-${component_id}` : component

      await supabase
        .from('system_status')
        .upsert({
          id: key,
          component,
          component_id,
          status,
          message,
          metadata,
          updated_at: new Date().toISOString()
        })
    }

    return successResponse({ updated: updates.length })
  } catch (error) {
    console.error('POST /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)
```

---

## Task 4: Reference Data API

### 4.1 `app/api/ai/defect-classes/route.js`

```javascript
/**
 * Defect Classes API (Read-only for AI Backend)
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/ai/defect-classes error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
```

### 4.2 `app/api/ai/false-call-reasons/route.js`

```javascript
/**
 * False Call Reasons API (Read-only for AI Backend)
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/ai/false-call-reasons error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
```

---

## Verification Checklist

### Inspections API
- [ ] `POST /api/ai/inspections` — creates inspection
- [ ] `GET /api/ai/inspections` — lists with filters
- [ ] `GET /api/ai/inspections/[id]` — gets by external ID
- [ ] `PATCH /api/ai/inspections/[id]` — updates AI data

### Models API
- [ ] `GET /api/ai/models` — lists models
- [ ] `POST /api/ai/models` — creates model
- [ ] `GET /api/ai/models/[id]` — gets by ID
- [ ] `PATCH /api/ai/models/[id]` — updates model
- [ ] `DELETE /api/ai/models/[id]` — deletes model

### System Status API
- [ ] `GET /api/ai/system-status` — gets grouped status
- [ ] `POST /api/ai/system-status` — updates status (single/batch)

### Reference Data API
- [ ] `GET /api/ai/defect-classes` — lists defect classes
- [ ] `GET /api/ai/false-call-reasons` — lists false call reasons

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

// Schema matches actual DB columns:
// id, name, version, description, training_job_id, dataset_id, storage_path, public_url,
// file_size, base_model, framework, map50, map50_95, precision_val, recall,
// inference_speed_ms, status, is_active, deployed_at, deployed_by, created_by, created_at
const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'deprecated']).default('draft'),
  storagePath: z.string().optional(),  // maps to storage_path
  publicUrl: z.string().optional(),
  baseModel: z.string().optional(),
  framework: z.string().default('yolov10'),
  trainingJobId: z.string().optional(),
  datasetId: z.string().uuid().optional()
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

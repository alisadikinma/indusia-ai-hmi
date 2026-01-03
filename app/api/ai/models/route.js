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

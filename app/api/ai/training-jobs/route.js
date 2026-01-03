/**
 * AI Backend API: Training Jobs
 * GET /api/ai/training-jobs - List training jobs
 * POST /api/ai/training-jobs - Create training job
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

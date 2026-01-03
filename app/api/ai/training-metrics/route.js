/**
 * AI Backend API: Training Metrics
 * GET /api/ai/training-metrics - List training metrics by job
 * POST /api/ai/training-metrics - Log single epoch metric
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse, errorResponse } from '@/lib/utils/apiResponse'
import { trainingMetricsRepo } from '@/lib/repos/trainingMetricsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const logMetricSchema = z.object({
  job_id: z.string().uuid(),
  epoch: z.number().int().min(0),
  train_loss: z.number().optional(),
  val_loss: z.number().optional(),
  train_acc: z.number().min(0).max(1).optional(),
  val_acc: z.number().min(0).max(1).optional(),
  learning_rate: z.number().positive().optional(),
  metrics: z.object({}).passthrough().optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return errorResponse('job_id query parameter is required', 'VALIDATION_ERROR', 400)
    }

    const filters = {
      jobId,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    }

    const result = await trainingMetricsRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/training-metrics error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(logMetricSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await trainingMetricsRepo.log(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/training-metrics error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

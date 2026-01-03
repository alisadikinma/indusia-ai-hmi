/**
 * AI Backend API: Training Job by ID
 * GET /api/ai/training-jobs/[id] - Get training job status
 * PATCH /api/ai/training-jobs/[id] - Update training job progress
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingJobsRepo } from '@/lib/repos/trainingJobsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const updateJobSchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  progress: z.number().min(0).max(100).optional(),
  current_epoch: z.number().int().min(0).optional(),
  error_message: z.string().optional(),
  result_model_id: z.string().uuid().optional()
})

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const result = await trainingJobsRepo.getById(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Training job not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/training-jobs/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(updateJobSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if job exists
    const existing = await trainingJobsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training job not found')
    }

    const result = await trainingJobsRepo.updateStatus(id, validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/training-jobs/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)

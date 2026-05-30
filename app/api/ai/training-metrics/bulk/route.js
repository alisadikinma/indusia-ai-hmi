/**
 * AI Backend API: Training Metrics Bulk Operations
 * POST /api/ai/training-metrics/bulk - Bulk log training metrics (multiple epochs)
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingMetricsRepo } from '@/lib/repos/trainingMetricsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const bulkLogSchema = z.object({
  job_id: z.string().uuid(),
  metrics: z.array(z.object({
    epoch: z.number().int().min(0),
    train_loss: z.number().optional(),
    val_loss: z.number().optional(),
    train_acc: z.number().min(0).max(1).optional(),
    val_acc: z.number().min(0).max(1).optional(),
    learning_rate: z.number().positive().optional(),
    metrics: z.object({}).passthrough().optional()
  })).min(1).max(1000)
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(bulkLogSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await trainingMetricsRepo.bulkLog(
      validation.data.job_id,
      validation.data.metrics
    )

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({
      logged: result.data.length,
      metrics: result.data
    })
  } catch (error) {
    console.error('POST /api/ai/training-metrics/bulk error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)

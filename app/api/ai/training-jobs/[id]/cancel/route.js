/**
 * AI Backend API: Cancel Training Job
 * POST /api/ai/training-jobs/[id]/cancel - Cancel a running training job
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse, errorResponse } from '@/lib/utils/apiResponse'
import { trainingJobsRepo } from '@/lib/repos/trainingJobsRepo'

async function handlePOST(request, { params }) {
  try {
    const { id } = await params

    // Check if job exists
    const existing = await trainingJobsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training job not found')
    }

    const result = await trainingJobsRepo.cancel(id)

    if (!result.success) {
      return errorResponse(result.error, 'CANCEL_FAILED', 400)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/training-jobs/[id]/cancel error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)

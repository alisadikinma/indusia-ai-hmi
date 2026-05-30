/**
 * AI Backend API: Training Dataset by ID
 * GET /api/ai/training-datasets/[id] - Get training dataset details
 * PATCH /api/ai/training-datasets/[id] - Update training dataset
 * DELETE /api/ai/training-datasets/[id] - Delete training dataset
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingDatasetsRepo } from '@/lib/repos/trainingDatasetsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const updateDatasetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
  split_config: z.object({
    train: z.number().min(0).max(100),
    val: z.number().min(0).max(100),
    test: z.number().min(0).max(100)
  }).optional()
})

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const result = await trainingDatasetsRepo.getById(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Training dataset not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/training-datasets/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(updateDatasetSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if dataset exists
    const existing = await trainingDatasetsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training dataset not found')
    }

    const result = await trainingDatasetsRepo.update(id, validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/training-datasets/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const { id } = await params

    // Check if dataset exists
    const existing = await trainingDatasetsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training dataset not found')
    }

    const result = await trainingDatasetsRepo.delete(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ deleted: true, id })
  } catch (error) {
    console.error('DELETE /api/ai/training-datasets/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
export const DELETE = withApiKeyAuth(handleDELETE)

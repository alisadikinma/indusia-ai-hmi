/**
 * AI Backend API: Dataset Image by ID
 * GET /api/ai/dataset-images/[id] - Get dataset image
 * PATCH /api/ai/dataset-images/[id] - Update dataset image
 * DELETE /api/ai/dataset-images/[id] - Delete dataset image
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { datasetImagesRepo } from '@/lib/repos/datasetImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const updateImageSchema = z.object({
  annotations: z.array(z.any()).optional(),
  is_labeled: z.boolean().optional(),
  metadata: z.object({}).passthrough().optional()
})

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const result = await datasetImagesRepo.getById(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Dataset image not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/dataset-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(updateImageSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if image exists
    const existing = await datasetImagesRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Dataset image not found')
    }

    const result = await datasetImagesRepo.update(id, validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/dataset-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const { id } = await params

    // Check if image exists
    const existing = await datasetImagesRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Dataset image not found')
    }

    const result = await datasetImagesRepo.delete(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ deleted: true, id })
  } catch (error) {
    console.error('DELETE /api/ai/dataset-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
export const DELETE = withApiKeyAuth(handleDELETE)

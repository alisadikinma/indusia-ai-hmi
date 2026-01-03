/**
 * AI Backend API: Dataset Images Bulk Operations
 * POST /api/ai/dataset-images/bulk - Bulk create dataset images
 * DELETE /api/ai/dataset-images/bulk - Bulk delete dataset images
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { datasetImagesRepo } from '@/lib/repos/datasetImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const bulkCreateSchema = z.object({
  images: z.array(z.object({
    file_path: z.string().min(1),
    file_name: z.string().min(1),
    source: z.enum(['upload', 'inspection', 'augmented']).default('upload'),
    annotations: z.array(z.any()).optional(),
    is_labeled: z.boolean().default(false),
    metadata: z.object({}).passthrough().optional()
  })).min(1).max(1000)
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000)
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(bulkCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await datasetImagesRepo.bulkCreate(validation.data.images)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/dataset-images/bulk error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request) {
  try {
    const body = await request.json()
    const validation = validate(bulkDeleteSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await datasetImagesRepo.bulkDelete(validation.data.ids)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('DELETE /api/ai/dataset-images/bulk error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)
export const DELETE = withApiKeyAuth(handleDELETE)

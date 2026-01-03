/**
 * AI Backend API: Dataset Images
 * GET /api/ai/dataset-images - List dataset images
 * POST /api/ai/dataset-images - Create dataset image record
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { datasetImagesRepo } from '@/lib/repos/datasetImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createImageSchema = z.object({
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  source: z.enum(['upload', 'inspection', 'augmented']).default('upload'),
  annotations: z.array(z.any()).optional(),
  is_labeled: z.boolean().default(false),
  metadata: z.object({}).passthrough().optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      datasetId: searchParams.get('dataset_id'),
      source: searchParams.get('source'),
      isLabeled: searchParams.get('is_labeled') === 'true' ? true :
                 searchParams.get('is_labeled') === 'false' ? false : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await datasetImagesRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/dataset-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createImageSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await datasetImagesRepo.create(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/dataset-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

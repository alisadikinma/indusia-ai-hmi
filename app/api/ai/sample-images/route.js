/**
 * AI Backend API: Sample Images
 * GET /api/ai/sample-images - List sample images
 * POST /api/ai/sample-images - Create sample image record
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { sampleImagesRepo } from '@/lib/repos/sampleImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createSampleSchema = z.object({
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  category: z.enum(['good', 'defect', 'reference']).default('reference'),
  board_id: z.string().uuid().optional(),
  defect_class_id: z.string().uuid().optional(),
  description: z.string().optional(),
  metadata: z.object({}).passthrough().optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      category: searchParams.get('category'),
      boardId: searchParams.get('board_id'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    }

    const result = await sampleImagesRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/sample-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createSampleSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await sampleImagesRepo.create(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/sample-images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

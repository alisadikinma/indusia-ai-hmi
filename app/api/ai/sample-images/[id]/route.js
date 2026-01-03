/**
 * AI Backend API: Sample Image by ID
 * GET /api/ai/sample-images/[id] - Get sample image
 * PATCH /api/ai/sample-images/[id] - Update sample image
 * DELETE /api/ai/sample-images/[id] - Delete sample image
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { sampleImagesRepo } from '@/lib/repos/sampleImagesRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const updateSampleSchema = z.object({
  category: z.enum(['good', 'defect', 'reference']).optional(),
  defect_class_id: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  metadata: z.object({}).passthrough().optional()
})

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const result = await sampleImagesRepo.getById(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Sample image not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/sample-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(updateSampleSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if sample exists
    const existing = await sampleImagesRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Sample image not found')
    }

    const result = await sampleImagesRepo.update(id, validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/sample-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const { id } = await params

    // Check if sample exists
    const existing = await sampleImagesRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Sample image not found')
    }

    const result = await sampleImagesRepo.delete(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ deleted: true, id })
  } catch (error) {
    console.error('DELETE /api/ai/sample-images/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
export const DELETE = withApiKeyAuth(handleDELETE)

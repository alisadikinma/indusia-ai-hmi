/**
 * AI Backend API: Training Dataset Images
 * GET /api/ai/training-datasets/[id]/images - List images in dataset
 * POST /api/ai/training-datasets/[id]/images - Add images to dataset
 * DELETE /api/ai/training-datasets/[id]/images - Remove images from dataset
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, paginatedResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingDatasetsRepo } from '@/lib/repos/trainingDatasetsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const addImagesSchema = z.object({
  image_ids: z.array(z.string().uuid()).min(1).max(1000)
})

const removeImagesSchema = z.object({
  image_ids: z.array(z.string().uuid()).min(1).max(1000)
})

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    // Check if dataset exists
    const existing = await trainingDatasetsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training dataset not found')
    }

    const filters = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await trainingDatasetsRepo.getImages(id, filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/training-datasets/[id]/images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(addImagesSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if dataset exists
    const existing = await trainingDatasetsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training dataset not found')
    }

    const result = await trainingDatasetsRepo.addImages(id, validation.data.image_ids)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/training-datasets/[id]/images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = validate(removeImagesSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Check if dataset exists
    const existing = await trainingDatasetsRepo.getById(id)
    if (!existing.success || !existing.data) {
      return notFoundResponse('Training dataset not found')
    }

    const result = await trainingDatasetsRepo.removeImages(id, validation.data.image_ids)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ removed: true, dataset_id: id })
  } catch (error) {
    console.error('DELETE /api/ai/training-datasets/[id]/images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)
export const DELETE = withApiKeyAuth(handleDELETE)

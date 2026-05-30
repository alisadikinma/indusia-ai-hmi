/**
 * AI Backend API: Training Datasets
 * GET /api/ai/training-datasets - List training datasets
 * POST /api/ai/training-datasets - Create training dataset
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, paginatedResponse, validationErrorResponse } from '@/lib/utils/apiResponse'
import { trainingDatasetsRepo } from '@/lib/repos/trainingDatasetsRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createDatasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(['draft', 'ready', 'archived']).default('draft'),
  split_config: z.object({
    train: z.number().min(0).max(100).default(80),
    val: z.number().min(0).max(100).default(10),
    test: z.number().min(0).max(100).default(10)
  }).optional()
})

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      status: searchParams.get('status'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await trainingDatasetsRepo.list(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/training-datasets error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createDatasetSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const result = await trainingDatasetsRepo.create(validation.data)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/training-datasets error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

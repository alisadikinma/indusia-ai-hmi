/**
 * AI Inspections API
 * POST: Create inspection from AI detection
 * GET: List inspections with filters
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, createdResponse, validationErrorResponse, paginatedResponse } from '@/lib/utils/apiResponse'
import { inspectionRepo } from '@/lib/repos/inspectionRepo'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createInspectionSchema = z.object({
  external_inspection_id: z.string().min(1),
  line_id: z.string(),
  model_id: z.string().uuid().optional(),
  model_name: z.string().optional(),
  ai_decision: z.enum(['PASS', 'FAIL']),
  ai_timestamp: z.string().datetime(),
  results: z.object({
    top: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }),
    bottom: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }).optional()
  })
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createInspectionSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const data = validation.data

    // Transform to database format
    const inspectionData = {
      externalInspectionId: data.external_inspection_id,
      lineId: data.line_id,
      modelId: data.model_id,
      modelName: data.model_name,
      aiDecision: data.ai_decision,
      aiTimestamp: data.ai_timestamp,
      aiImageUrlTop: data.results.top?.image_url,
      aiImageUrlBottom: data.results.bottom?.image_url,
      aiObjectsTop: data.results.top?.objects || [],
      aiObjectsBottom: data.results.bottom?.objects || []
    }

    const result = await inspectionRepo.createFromAi(inspectionData)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return createdResponse(result.data)
  } catch (error) {
    console.error('POST /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      lineId: searchParams.get('line_id'),
      aiDecision: searchParams.get('ai_decision'),
      isFalseCall: searchParams.get('is_false_call') === 'true' ? true :
                   searchParams.get('is_false_call') === 'false' ? false : undefined,
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    }

    const result = await inspectionRepo.listForAi(filters)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return paginatedResponse(result.data, result.meta)
  } catch (error) {
    console.error('GET /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)
export const GET = withApiKeyAuth(handleGET)

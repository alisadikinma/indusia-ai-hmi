/**
 * AI Model by ID
 * GET: Get model details
 * PATCH: Update model
 * DELETE: Delete model
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse } from '@/lib/utils/apiResponse'
import { aiModelsRepo } from '@/lib/repos/aiModelsRepo'

async function handleGET(request, { params }) {
  try {
    const { id } = await params
    const result = await aiModelsRepo.getById(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Model')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await aiModelsRepo.update(id, body)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleDELETE(request, { params }) {
  try {
    const { id } = await params
    const result = await aiModelsRepo.delete(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse({ message: 'Model deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/ai/models/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)
export const DELETE = withApiKeyAuth(handleDELETE)

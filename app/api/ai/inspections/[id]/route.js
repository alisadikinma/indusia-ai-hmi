/**
 * AI Inspection by External ID
 * GET: Get inspection details
 * PATCH: Update AI-side data
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse, notFoundResponse } from '@/lib/utils/apiResponse'
import { inspectionRepo } from '@/lib/repos/inspectionRepo'

async function handleGET(request, { params }) {
  try {
    const { id } = await params

    const result = await inspectionRepo.getByExternalId(id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return notFoundResponse('Inspection')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('GET /api/ai/inspections/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Only allow AI-side fields to be updated
    const allowedFields = ['ai_decision', 'ai_objects_top', 'ai_objects_bottom']
    const updates = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const result = await inspectionRepo.updateByExternalId(id, updates)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('PATCH /api/ai/inspections/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const PATCH = withApiKeyAuth(handlePATCH)

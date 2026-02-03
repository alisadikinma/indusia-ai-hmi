import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { withAuth } from '@/lib/auth/apiAuth'

/**
 * GET /api/overrides/:id
 */
async function handleGET(request, { params }) {
  try {
    const { id } = params
    const result = await overridesRepo.getById(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/overrides/:id
 * Body: { action: 'approve'|'reject', reviewerId, reviewerName, reviewNotes }
 *
 * Approval only updates status in local DB.
 * Image upload to cloud storage happens during sync-to-cloud process.
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    if (!body.reviewerId || !body.reviewerName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: reviewerId, reviewerName' },
        { status: 400 }
      )
    }

    let result

    if (body.action === 'approve') {
      result = await overridesRepo.approve(
        id,
        body.reviewerId,
        body.reviewerName,
        body.reviewNotes || ''
      )
    } else {
      result = await overridesRepo.reject(
        id,
        body.reviewerId,
        body.reviewerName,
        body.reviewNotes || ''
      )
    }

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const GET = withAuth('overrides:read')(handleGET)
export const PATCH = withAuth('overrides:review')(handlePATCH)

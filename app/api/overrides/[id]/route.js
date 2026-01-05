import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo'

/**
 * GET /api/overrides/:id
 */
export async function GET(request, { params }) {
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
 */
export async function PATCH(request, { params }) {
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
      
      // Add to sync queue for cloud upload
      if (result.data) {
        try {
          await syncQueueRepo.addToQueue({
            inspectionId: null, // Override-based, not inspection
            boardId: result.data.boardId || result.data.board_id,
            customerName: result.data.customerName || 'Unknown',
            sectionName: result.data.sectionName || 'Unknown',
            lineName: result.data.lineName || 'Unknown',
            defectType: result.data.defectType || result.data.defect_type || 'false_call',
            localImagePath: result.data.imageUrl || result.data.image_url,
            recordType: 'override',
          })
          console.log('[PATCH /api/overrides] Added to sync queue:', id)
        } catch (syncError) {
          console.warn('[PATCH /api/overrides] Sync queue add failed:', syncError)
          // Don't fail the approval
        }
      }
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

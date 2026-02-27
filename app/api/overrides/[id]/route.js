import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { updateWorkOrderCounters } from '@/lib/repos/workOrderRepo'
import { bumpWoCounterVersion } from '@/lib/services/lineStateStore'

/**
 * Parse ng_frame_details from override record
 */
function parseFrameDetails(override) {
  const raw = override.ngFrameDetails || override.ng_frame_details
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Compute WO counter adjustment based on override review outcome.
 * Returns { woId, goodQty, ngQty, falseCallQty } or null if no adjustment needed.
 *
 * Logic:
 * - approve: no change (operator was right, PCB is GOOD)
 * - reject: all disputed frames were wrong → all PCBs flip GOOD→NG
 * - review (per-frame): group by SN, if ANY frame rejected → that PCB flips
 */
function computeCounterAdjustment(action, override, frameDecisions) {
  const woId = override.workOrderId || override.work_order_id
  if (!woId) return null

  if (action === 'approve') return null

  if (action === 'review') {
    const frames = parseFrameDetails(override)
    if (!frames.length) return null

    // Detect key format: per-object ("TOP-0-OBJ-1") vs per-frame ("TOP-0")
    const isPerObject = Object.keys(frameDecisions || {}).some(k => k.includes('-OBJ-'))

    // Group frames by serial number (same as SN tabs in UI)
    const snGroups = {}
    frames.forEach(f => {
      const sn = f.serialNumber || `PCB-${f.frameIndex}`
      if (!snGroups[sn]) snGroups[sn] = []
      snGroups[sn].push(f)
    })

    // Count PCBs where manager rejected at least one frame/object
    let rejectedPcbs = 0
    for (const snFrames of Object.values(snGroups)) {
      let hasRejection = false
      if (isPerObject) {
        // Per-object: check if any object in any frame of this SN is rejected
        hasRejection = snFrames.some(f => {
          return (f.objects || []).some((_, objIdx) => {
            const key = `${f.side}-${f.frameIndex}-OBJ-${objIdx}`
            return frameDecisions?.[key] === 'rejected'
          })
        })
      } else {
        // Per-frame (legacy): check frame-level keys
        hasRejection = snFrames.some(f => {
          const key = `${f.side}-${f.frameIndex}`
          return frameDecisions?.[key] === 'rejected'
        })
      }
      if (hasRejection) rejectedPcbs++
    }

    if (rejectedPcbs === 0) return null
    return { woId, goodQty: -rejectedPcbs, ngQty: rejectedPcbs, falseCallQty: -rejectedPcbs }
  }

  if (action === 'reject') {
    // Legacy single-decision reject: all disputed PCBs flip
    const frames = parseFrameDetails(override)
    if (frames.length > 0) {
      const snCount = new Set(frames.map(f => f.serialNumber || `PCB-${f.frameIndex}`)).size
      return { woId, goodQty: -snCount, ngQty: snCount, falseCallQty: -snCount }
    }
    // No frame details: single override, assume 1 PCB
    return { woId, goodQty: -1, ngQty: 1, falseCallQty: -1 }
  }

  return null
}

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
 * Body: { action: 'approve'|'reject'|'review', reviewerId, reviewerName, reviewNotes, frameDecisions? }
 *
 * action='review': Per-object review with frameDecisions/objectDecisions
 *   - New format (per-object): { "TOP-0-OBJ-0": "approved", "TOP-0-OBJ-1": "rejected", ... }
 *   - Legacy format (per-frame): { "TOP-0": "approved", ... }
 * action='approve'/'reject': Legacy single-decision review
 * Image upload to cloud storage happens during sync-to-cloud process.
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!body.action || !['approve', 'reject', 'review'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve", "reject", or "review"' },
        { status: 400 }
      )
    }

    if (!body.reviewerId || !body.reviewerName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: reviewerId, reviewerName' },
        { status: 400 }
      )
    }

    // Accept either frameDecisions (legacy per-frame) or objectDecisions (new per-object)
    const decisions = body.frameDecisions || body.objectDecisions
    if (body.action === 'review' && (!decisions || Object.keys(decisions).length === 0)) {
      return NextResponse.json(
        { success: false, error: 'frameDecisions or objectDecisions is required for review action' },
        { status: 400 }
      )
    }

    // Fetch override BEFORE updating (need ng_frame_details + work_order_id for counter patch)
    const existing = await overridesRepo.getById(id)
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { success: false, error: existing.error || 'Override not found' },
        { status: 404 }
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
    } else if (body.action === 'reject') {
      result = await overridesRepo.reject(
        id,
        body.reviewerId,
        body.reviewerName,
        body.reviewNotes || ''
      )
    } else {
      result = await overridesRepo.review(
        id,
        body.reviewerId,
        body.reviewerName,
        decisions,
        body.reviewNotes || ''
      )
    }

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Patch WO counters based on review outcome (rejected objects/frames flip GOOD→NG)
    let counterAdjustment = null
    try {
      counterAdjustment = computeCounterAdjustment(body.action, existing.data, decisions)
      if (counterAdjustment) {
        const { woId, ...deltas } = counterAdjustment
        const patchResult = await updateWorkOrderCounters(woId, deltas)
        if (patchResult.success) {
          console.log(`[Override] Counter adjustment for WO ${woId}:`, deltas)
          // Notify live view via line-state version bump
          const lineId = patchResult.data?.lineId
          if (lineId) {
            bumpWoCounterVersion(lineId)
          }
        } else {
          console.warn(`[Override] Counter adjustment failed for WO ${woId}:`, patchResult.error)
        }
      }
    } catch (patchErr) {
      // Don't fail the override review if counter patch fails
      console.error('[Override] Counter patch error (non-fatal):', patchErr.message)
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      counterAdjustment: counterAdjustment ? {
        goodQty: counterAdjustment.goodQty,
        ngQty: counterAdjustment.ngQty,
        falseCallQty: counterAdjustment.falseCallQty,
      } : null,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const GET = withAuth('overrides:read')(handleGET)
export const PATCH = withAuth('overrides:review')(handlePATCH)

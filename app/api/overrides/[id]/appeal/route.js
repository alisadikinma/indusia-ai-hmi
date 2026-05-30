import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { withAuth } from '@/lib/auth/apiAuth'

/**
 * POST /api/overrides/:id/appeal
 * Appeal a reviewed object decision. Only managers can appeal.
 * Each object can only be appealed once.
 *
 * Body: {
 *   objectKey: "TOP-0-OBJ-1",     // which object to appeal
 *   reason: "Defect is clearly visible on zoomed image",
 *   appealedBy: userId,
 *   appealedByName: userName,
 * }
 */
async function handlePOST(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!body.objectKey || !body.reason?.trim() || !body.appealedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: objectKey, reason, appealedBy' },
        { status: 400 }
      )
    }

    // Validate objectKey format to prevent prototype pollution
    if (!/^(TOP|BOTTOM)-\d+-OBJ-\d+$/.test(body.objectKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid objectKey format. Expected: TOP-0-OBJ-0 or BOTTOM-1-OBJ-2' },
        { status: 400 }
      )
    }

    // Limit reason length
    if (body.reason.trim().length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Appeal reason must be 2000 characters or less.' },
        { status: 400 }
      )
    }

    // Fetch the override
    const existing = await overridesRepo.getById(id)
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { success: false, error: 'Override not found' },
        { status: 404 }
      )
    }

    const override = existing.data

    // Must be reviewed status (has per-object or per-frame decisions)
    if (override.status !== 'reviewed') {
      return NextResponse.json(
        { success: false, error: `Cannot appeal override with status "${override.status}". Only reviewed overrides can be appealed.` },
        { status: 400 }
      )
    }

    // Check the object has been decided
    const decisions = override.frameDecisions || override.frame_decisions || {}
    const parsedDecisions = typeof decisions === 'string' ? JSON.parse(decisions) : decisions
    if (!parsedDecisions[body.objectKey]) {
      return NextResponse.json(
        { success: false, error: `Object "${body.objectKey}" has no decision to appeal` },
        { status: 400 }
      )
    }

    // Check not already appealed (stored in appeal_decisions JSON)
    const appealDecisions = override.appealDecisions || override.appeal_decisions || {}
    const parsedAppeals = typeof appealDecisions === 'string' ? JSON.parse(appealDecisions) : appealDecisions
    if (parsedAppeals[body.objectKey]) {
      return NextResponse.json(
        { success: false, error: 'This object has already been appealed' },
        { status: 400 }
      )
    }

    // Store appeal in appeal_decisions JSON on the override record
    const updatedAppeals = {
      ...parsedAppeals,
      [body.objectKey]: {
        status: 'appealed',
        reason: body.reason.trim(),
        appealedBy: body.appealedBy,
        appealedByName: body.appealedByName || '',
        appealedAt: new Date().toISOString(),
      }
    }

    const result = await overridesRepo.submitAppeal(id, updatedAppeals)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[POST /api/overrides/[id]/appeal] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit appeal' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/overrides/:id/appeal
 * Resolve an appeal (re-approve or re-reject). Only managers can resolve.
 *
 * Body: {
 *   objectKey: "TOP-0-OBJ-1",
 *   decision: "re_approved" | "re_rejected",
 *   reason: "After re-review, defect confirmed",
 *   decidedBy: userId,
 *   decidedByName: userName,
 * }
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!body.objectKey || !body.decision || !body.decidedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: objectKey, decision, decidedBy' },
        { status: 400 }
      )
    }

    if (!['re_approved', 're_rejected'].includes(body.decision)) {
      return NextResponse.json(
        { success: false, error: 'Decision must be "re_approved" or "re_rejected"' },
        { status: 400 }
      )
    }

    const existing = await overridesRepo.getById(id)
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { success: false, error: 'Override not found' },
        { status: 404 }
      )
    }

    const override = existing.data
    const appealDecisions = override.appealDecisions || override.appeal_decisions || {}
    const parsedAppeals = typeof appealDecisions === 'string' ? JSON.parse(appealDecisions) : appealDecisions

    if (!parsedAppeals[body.objectKey] || parsedAppeals[body.objectKey].status !== 'appealed') {
      return NextResponse.json(
        { success: false, error: 'No pending appeal found for this object' },
        { status: 400 }
      )
    }

    // Update the appeal with the decision
    const updatedAppeals = {
      ...parsedAppeals,
      [body.objectKey]: {
        ...parsedAppeals[body.objectKey],
        status: body.decision,
        decisionReason: body.reason?.trim() || '',
        decidedBy: body.decidedBy,
        decidedByName: body.decidedByName || '',
        decidedAt: new Date().toISOString(),
      }
    }

    // Also update the main frame_decisions with the appeal outcome
    const frameDecisions = override.frameDecisions || override.frame_decisions || {}
    const parsedDecisions = typeof frameDecisions === 'string' ? JSON.parse(frameDecisions) : frameDecisions
    const updatedDecisions = {
      ...parsedDecisions,
      [body.objectKey]: body.decision === 're_approved' ? 'approved' : 'rejected',
    }

    const result = await overridesRepo.resolveAppeal(id, updatedAppeals, updatedDecisions)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[PATCH /api/overrides/[id]/appeal] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resolve appeal' },
      { status: 500 }
    )
  }
}

export const POST = withAuth('overrides:review')(handlePOST)
export const PATCH = withAuth('overrides:review')(handlePATCH)

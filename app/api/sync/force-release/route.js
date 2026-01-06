/**
 * POST /api/sync/force-release
 *
 * Force release a stuck sync lock.
 * Admin only - should be protected by auth.
 */

import { NextResponse } from 'next/server'
import { forceReleaseLock, getLockStatus } from '@/lib/sync'
import { withAuth } from '@/lib/auth/apiAuth'

async function handlePOST(request) {
  try {
    // Get current lock status first
    const before = await getLockStatus()

    if (!before.locked) {
      return NextResponse.json({
        success: true,
        message: 'No lock to release'
      })
    }

    // Force release
    const result = await forceReleaseLock()

    if (!result.released) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to release lock'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Lock released (was held by ${before.lockedBy})`
    })

  } catch (error) {
    console.error('[API] Force release error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Protect with admin permission
export const POST = withAuth('sync:admin')(handlePOST)

/**
 * GET /api/sync/progress
 *
 * Get current sync progress (for polling during sync).
 */

import { NextResponse } from 'next/server'
import { getLockStatus, getPcName } from '@/lib/sync'

export async function GET() {
  try {
    const lock = await getLockStatus()
    const myPcName = getPcName()

    if (!lock.locked) {
      return NextResponse.json({
        success: true,
        data: {
          inProgress: false
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        inProgress: true,
        isMySync: lock.lockedBy === myPcName,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
        progress: {
          current: lock.progress?.current || 0,
          total: lock.progress?.total || 0,
          table: lock.progress?.table,
          percent: lock.progress?.total > 0
            ? Math.round((lock.progress.current / lock.progress.total) * 100)
            : 0
        }
      }
    })

  } catch (error) {
    console.error('[API] Sync progress error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

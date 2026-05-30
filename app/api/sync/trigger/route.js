/**
 * POST /api/sync/trigger
 *
 * Triggers a sync to cloud.
 * Returns immediately - sync runs in background.
 *
 * Body: { triggeredBy?: string }
 */

import { NextResponse } from 'next/server'
import {
  syncToCloud,
  checkOnlineStatus,
  acquireLock,
  getLockStatus,
  isCloudSyncConfigured,
  getPcName
} from '@/lib/sync'

// Track active sync (simple in-memory for single instance)
let activeSyncPromise = null

export async function POST(request) {
  try {
    console.log('[API sync/trigger] Starting...')
    
    // Check configuration
    if (!isCloudSyncConfigured()) {
      console.log('[API sync/trigger] Not configured')
      return NextResponse.json({
        success: false,
        error: 'Cloud sync not configured'
      }, { status: 400 })
    }

    // Parse body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // No body is fine
    }

    const triggeredBy = body.triggeredBy || 'manual'

    // Check online
    const { online, error: onlineError } = await checkOnlineStatus()
    console.log('[API sync/trigger] Online check:', online, onlineError)
    if (!online) {
      return NextResponse.json({
        success: false,
        error: `Cannot sync: ${onlineError || 'Offline'}`
      }, { status: 503 })
    }

    // Check lock
    const lock = await getLockStatus()
    console.log('[API sync/trigger] Lock status:', lock)
    if (lock.locked) {
      return NextResponse.json({
        success: false,
        error: `Sync already in progress by ${lock.lockedBy}`,
        data: {
          lockedBy: lock.lockedBy,
          expiresAt: lock.expiresAt,
          progress: lock.progress
        }
      }, { status: 409 })
    }

    console.log('[API sync/trigger] Starting syncToCloud...')
    
    // Start sync in background (don't await)
    activeSyncPromise = syncToCloud({ triggeredBy })
      .then(result => {
        console.log('[Sync] Completed:', result.stats)
        activeSyncPromise = null
        return result
      })
      .catch(err => {
        console.error('[Sync] Failed:', err)
        activeSyncPromise = null
      })

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      data: {
        startedBy: getPcName(),
        triggeredBy
      }
    })

  } catch (error) {
    console.error('[API] Trigger sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/sync/trigger
 *
 * Check if sync is currently running on this instance
 */
export async function GET() {
  const lock = await getLockStatus()

  return NextResponse.json({
    success: true,
    data: {
      inProgress: lock.locked,
      lockedBy: lock.lockedBy,
      progress: lock.progress
    }
  })
}

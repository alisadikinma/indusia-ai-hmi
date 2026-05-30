/**
 * GET /api/sync/status
 *
 * Returns current sync status including:
 * - Online status
 * - Last sync time
 * - Pending records count
 * - Lock status
 */

import { NextResponse } from 'next/server'
import { getSyncStatus, getLockStatus, isCloudSyncConfigured } from '@/lib/sync'

export async function GET() {
  try {
    // Check if sync is configured
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          online: false,
          message: 'Cloud sync not configured'
        }
      })
    }

    // Get sync status
    const status = await getSyncStatus()
    const lock = await getLockStatus()

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        online: status.online,
        latency: status.latency,
        lastSync: status.lastSync,
        pending: status.pending,
        totalPending: status.totalPending,
        lock: lock.locked ? {
          lockedBy: lock.lockedBy,
          lockedAt: lock.lockedAt,
          expiresAt: lock.expiresAt,
          progress: lock.progress
        } : null
      }
    })

  } catch (error) {
    console.error('[API] Sync status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/sync/check-online
 *
 * Quick check if Supabase cloud is reachable.
 * Used for connection status indicator.
 */

import { NextResponse } from 'next/server'
import { quickOnlineCheck, isCloudSyncConfigured } from '@/lib/sync'

export async function GET() {
  try {
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          online: false,
          configured: false,
          message: 'Cloud sync not configured'
        }
      })
    }

    const result = await quickOnlineCheck()

    return NextResponse.json({
      success: true,
      data: {
        online: result.online,
        latency: result.latency,
        error: result.error
      }
    })

  } catch (error) {
    console.error('[API] Online check error:', error)
    return NextResponse.json({
      success: true, // Don't fail the request
      data: {
        online: false,
        error: error.message
      }
    })
  }
}

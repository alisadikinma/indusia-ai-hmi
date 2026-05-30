/**
 * Sync Execution API
 * POST /api/sync-queue/sync - Execute sync from Local PG to Supabase Cloud
 * 
 * Syncs pending records from local tables to cloud database
 */

import { NextResponse } from 'next/server'
import { syncToCloud, isCloudSyncConfigured } from '@/lib/sync'
import syncRepo from '@/lib/repos/syncRepo'

export async function POST(request) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { userId } = body

    // Check if cloud sync is configured
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Cloud sync not configured. Check SUPABASE_CLOUD_URL and SUPABASE_SERVICE_KEY in .env.local'
      }, { status: 400 })
    }

    // Check pending count first
    const pendingCounts = await syncRepo.getPendingCounts()
    const totalPending = pendingCounts.reduce((sum, c) => sum + c.count, 0)

    if (totalPending === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No pending records to sync',
          syncedCount: 0,
          failedCount: 0,
          durationMs: Date.now() - startTime
        }
      })
    }

    console.log(`[Sync] Starting sync of ${totalPending} records...`)

    // Execute sync
    const result = await syncToCloud({
      triggeredBy: userId || 'manual',
      onProgress: (progress) => {
        console.log(`[Sync] Progress: ${progress.current}/${progress.total} (${progress.table})`)
      }
    })

    const durationMs = Date.now() - startTime

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        data: {
          ...result.stats,
          durationMs
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: result.message || 'Sync completed',
        totalCount: result.stats.processed,
        syncedCount: result.stats.success,
        failedCount: result.stats.failed,
        tables: result.stats.tables,
        durationMs
      }
    })

  } catch (error) {
    console.error('[API] POST /api/sync-queue/sync error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

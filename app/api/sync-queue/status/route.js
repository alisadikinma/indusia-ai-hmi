/**
 * Sync Status API
 * GET /api/sync-queue/status - Get sync status summary
 * 
 * Returns:
 * - lastSync: timestamp of last successful sync
 * - pending: counts of pending items by type
 * - status: overall sync status
 */

import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001'

export async function GET() {
  try {
    // Get pending overrides count
    let overridesCount = 0
    try {
      const overridesRes = await fetch(
        `${POSTGREST_URL}/overrides?synced=eq.false&select=id`,
        { headers: { 'Prefer': 'count=exact' } }
      )
      if (overridesRes.ok) {
        overridesCount = parseInt(overridesRes.headers.get('content-range')?.split('/')[1] || '0')
      }
    } catch (e) {
      console.warn('[SyncStatus] overrides query failed:', e.message)
    }

    // Get pending inspection_results count
    let resultsCount = 0
    try {
      const resultsRes = await fetch(
        `${POSTGREST_URL}/inspection_results?synced=eq.false&select=id`,
        { headers: { 'Prefer': 'count=exact' } }
      )
      if (resultsRes.ok) {
        resultsCount = parseInt(resultsRes.headers.get('content-range')?.split('/')[1] || '0')
      }
    } catch (e) {
      console.warn('[SyncStatus] inspection_results query failed:', e.message)
    }

    // Get pending inspection_stats count
    let statsCount = 0
    try {
      const statsRes = await fetch(
        `${POSTGREST_URL}/inspection_stats?synced=eq.false&select=id`,
        { headers: { 'Prefer': 'count=exact' } }
      )
      if (statsRes.ok) {
        statsCount = parseInt(statsRes.headers.get('content-range')?.split('/')[1] || '0')
      }
    } catch (e) {
      console.warn('[SyncStatus] inspection_stats query failed:', e.message)
    }

    // Get last sync time - try multiple sources
    let lastSync = null

    // Source 1: sync_history table (most accurate)
    try {
      const historyRes = await fetch(
        `${POSTGREST_URL}/sync_history?status=eq.success&order=synced_at.desc&limit=1`
      )
      if (historyRes.ok) {
        const history = await historyRes.json()
        if (history?.[0]?.synced_at) {
          lastSync = history[0].synced_at
        }
      }
    } catch (e) {
      console.warn('[SyncStatus] sync_history not available:', e.message)
    }

    // Source 2: Fallback to latest synced override
    if (!lastSync) {
      try {
        const syncedOverridesRes = await fetch(
          `${POSTGREST_URL}/overrides?synced=eq.true&order=synced_at.desc&limit=1&select=synced_at`
        )
        if (syncedOverridesRes.ok) {
          const syncedOverrides = await syncedOverridesRes.json()
          if (syncedOverrides?.[0]?.synced_at) {
            lastSync = syncedOverrides[0].synced_at
          }
        }
      } catch (e) {
        console.warn('[SyncStatus] synced overrides query failed:', e.message)
      }
    }

    // Source 3: Fallback to latest synced inspection_results
    if (!lastSync) {
      try {
        const syncedResultsRes = await fetch(
          `${POSTGREST_URL}/inspection_results?synced=eq.true&order=synced_at.desc&limit=1&select=synced_at`
        )
        if (syncedResultsRes.ok) {
          const syncedResults = await syncedResultsRes.json()
          if (syncedResults?.[0]?.synced_at) {
            lastSync = syncedResults[0].synced_at
          }
        }
      } catch (e) {
        console.warn('[SyncStatus] synced results query failed:', e.message)
      }
    }

    // Calculate total pending
    const totalPending = overridesCount + resultsCount + statsCount

    // Determine status
    let status = 'unknown'
    if (totalPending > 0) {
      status = 'pending'
    } else if (lastSync) {
      status = 'synced'
    }

    return NextResponse.json({
      success: true,
      data: {
        lastSync,
        pending: {
          overrides: overridesCount,
          inspectionResults: resultsCount,
          inspectionStats: statsCount,
          total: totalPending
        },
        status
      }
    })

  } catch (error) {
    console.error('[SyncStatus] Error:', error)
    return NextResponse.json({
      success: true,
      data: {
        lastSync: null,
        pending: { overrides: 0, inspectionResults: 0, inspectionStats: 0, total: 0 },
        status: 'error'
      }
    })
  }
}

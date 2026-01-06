/**
 * Sync to Cloud
 *
 * Uploads pending records from Local PostgreSQL to Supabase Cloud.
 * This is the main sync function called by the API.
 */

import { supabaseAdmin, isCloudSyncConfigured } from './supabaseAdmin'
import { acquireLock, releaseLock, updateProgress, getPcName } from './syncLock'
import { checkOnlineStatus } from './onlineCheck'
import syncRepo from '@/lib/repos/syncRepo'

const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE) || 100

// Tables to sync (order matters for FK dependencies)
const SYNC_TABLES = [
  'inspection_results',
  'inspection_defects',
  'overrides',
  'event_log',
  'inspection_stats'
]

/**
 * Main sync function
 * @param {object} options
 * @param {function} options.onProgress - Progress callback
 * @param {string} options.triggeredBy - Who triggered ('manual', 'auto', 'startup')
 * @returns {Promise<{success: boolean, stats: object, error?: string}>}
 */
export async function syncToCloud(options = {}) {
  const { onProgress, triggeredBy = 'manual' } = options
  const pcName = getPcName()

  const stats = {
    startedAt: new Date().toISOString(),
    processed: 0,
    success: 0,
    failed: 0,
    tables: [],
    machineName: pcName,
    triggeredBy
  }

  // 1. Check if configured
  if (!isCloudSyncConfigured()) {
    return {
      success: false,
      stats,
      error: 'Cloud sync not configured'
    }
  }

  // 2. Check online
  const { online, error: onlineError } = await checkOnlineStatus()
  if (!online) {
    return {
      success: false,
      stats,
      error: `Offline: ${onlineError}`
    }
  }

  // 3. Acquire lock (with auto-retry if stale lock cleared)
  let lockResult = await acquireLock(pcName)
  
  // If stale lock was cleared, retry once
  if (!lockResult.acquired && lockResult.staleCleared) {
    console.log('[Sync] Stale lock cleared, retrying acquire...')
    lockResult = await acquireLock(pcName)
  }
  
  if (!lockResult.acquired) {
    return {
      success: false,
      stats,
      error: lockResult.error 
        ? `Lock error: ${lockResult.error}`
        : lockResult.lockedBy 
          ? `Sync in progress by ${lockResult.lockedBy}` 
          : 'Failed to acquire sync lock'
    }
  }

  try {
    // 4. Get total pending count for progress
    const pendingCounts = await syncRepo.getPendingCounts()
    const totalPending = pendingCounts.reduce((sum, c) => sum + c.count, 0)

    if (totalPending === 0) {
      return { success: true, stats, message: 'No pending records' }
    }

    // 5. Sync each table
    let processed = 0

    for (const table of SYNC_TABLES) {
      const tableCount = pendingCounts.find(c => c.table === table)?.count || 0
      if (tableCount === 0) continue

      console.log(`[Sync] Starting ${table} (${tableCount} records)`)
      stats.tables.push(table)

      const result = await syncTable(table, async (current, total) => {
        processed++
        await updateProgress(processed, totalPending, table)
        onProgress?.({ current: processed, total: totalPending, table })
      })

      stats.processed += result.processed
      stats.success += result.success
      stats.failed += result.failed

      // Update sync state for this table
      await syncRepo.updateSyncState(table, result.success, result.failed, result.error)
    }

    // 6. Sync work orders (qty updates)
    const woResult = await syncWorkOrderUpdates()
    if (woResult.processed > 0) {
      stats.tables.push('work_orders')
      stats.processed += woResult.processed
      stats.success += woResult.success
      stats.failed += woResult.failed
    }

    // 7. Log sync session
    await syncRepo.logSyncSession(stats)

    return {
      success: stats.failed === 0,
      stats
    }

  } catch (err) {
    console.error('[Sync] Error:', err)
    stats.error = err.message
    return {
      success: false,
      stats,
      error: err.message
    }

  } finally {
    // Always release lock
    await releaseLock(pcName)
  }
}

/**
 * Sync a single table
 */
async function syncTable(table, onRecord) {
  const result = { processed: 0, success: 0, failed: 0, error: null }

  try {
    // Get pending records in batches
    let records = await syncRepo.getPendingRecords(table, BATCH_SIZE)

    while (records.length > 0) {
      for (const record of records) {
        try {
          // Remove sync columns before uploading
          const { sync_status, synced_at, sync_error, ...cloudData } = record

          // Upsert to cloud
          const { error } = await supabaseAdmin
            .from(table)
            .upsert(cloudData, { onConflict: 'id' })

          if (error) throw error

          // Mark as synced
          await syncRepo.markSynced(table, record.id)
          result.success++

        } catch (err) {
          console.error(`[Sync] Failed ${table}/${record.id}:`, err.message)
          await syncRepo.markFailed(table, record.id, err.message)
          result.failed++
        }

        result.processed++
        await onRecord?.(result.processed, result.processed)
      }

      // Get next batch
      records = await syncRepo.getPendingRecords(table, BATCH_SIZE)
    }

  } catch (err) {
    console.error(`[Sync] Error syncing ${table}:`, err)
    result.error = err.message
  }

  return result
}

/**
 * Sync work order quantity updates
 */
async function syncWorkOrderUpdates() {
  const result = { processed: 0, success: 0, failed: 0 }

  try {
    const records = await syncRepo.getPendingRecords('work_orders', BATCH_SIZE)

    for (const record of records) {
      try {
        // Only sync qty fields (not full record)
        const { error } = await supabaseAdmin
          .from('work_orders')
          .update({
            completed_qty: record.completed_qty,
            good_qty: record.good_qty,
            ng_qty: record.ng_qty,
            false_call_qty: record.false_call_qty,
            status: record.status,
            started_at: record.started_at,
            completed_at: record.completed_at,
            updated_at: record.updated_at
          })
          .eq('id', record.cloud_id || record.id)

        if (error) throw error

        await syncRepo.markSynced('work_orders', record.id)
        result.success++

      } catch (err) {
        console.error(`[Sync] Failed work_order/${record.id}:`, err.message)
        await syncRepo.markFailed('work_orders', record.id, err.message)
        result.failed++
      }

      result.processed++
    }

  } catch (err) {
    console.error('[Sync] Error syncing work_orders:', err)
  }

  return result
}

/**
 * Get sync status summary
 */
export async function getSyncStatus() {
  const pendingCounts = await syncRepo.getPendingCounts()
  const lastSync = await syncRepo.getLastSyncInfo()
  const online = await checkOnlineStatus()

  return {
    online: online.online,
    latency: online.latency,
    lastSync,
    pending: pendingCounts,
    totalPending: pendingCounts.reduce((sum, c) => sum + c.count, 0)
  }
}

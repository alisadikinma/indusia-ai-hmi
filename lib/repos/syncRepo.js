/**
 * Sync Repository
 *
 * Handles database operations for sync status tracking.
 * Reads from Local PostgreSQL via PostgREST.
 */

import { supabase } from '@/lib/supabaseClient'

const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE) || 100

/**
 * Get count of pending records per table
 * @returns {Promise<{table: string, count: number}[]>}
 */
export async function getPendingCounts() {
  // Tables that are actually synced to cloud
  // NOTE: event_log excluded due to schema mismatch
  const tables = [
    'inspection_results',
    'inspection_defects',
    'overrides',
    // 'event_log', // TODO: Fix schema mismatch
    'inspection_stats'
  ]

  const counts = []

  for (const table of tables) {
    // Count records with sync_status = pending/failed OR NULL (legacy records)
    // Use raw filter for complex OR condition
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .or('sync_status.eq.pending,sync_status.eq.failed,sync_status.is.null')

    if (error) {
      console.error(`[SyncRepo] Error counting ${table}:`, error)
    }
    counts.push({ table, count: count || 0 })
  }

  // Work orders with pending updates
  const { count: woCount, error: woError } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .or('sync_status.eq.pending,sync_status.is.null')

  if (woError) {
    console.error('[SyncRepo] Error counting work_orders:', woError)
  }
  counts.push({ table: 'work_orders', count: woCount || 0 })

  return counts
}

/**
 * Get total pending count
 */
export async function getTotalPendingCount() {
  const counts = await getPendingCounts()
  return counts.reduce((sum, c) => sum + c.count, 0)
}

/**
 * Get pending records from a table
 * @param {string} table - Table name
 * @param {number} limit - Max records to fetch
 */
export async function getPendingRecords(table, limit = BATCH_SIZE) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .or('sync_status.eq.pending,sync_status.eq.failed,sync_status.is.null')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error(`[SyncRepo] Error fetching pending ${table}:`, error)
    return []
  }

  return data || []
}

/**
 * Mark record as synced
 */
export async function markSynced(table, id) {
  const { error } = await supabase
    .from(table)
    .update({
      sync_status: 'synced',
      synced_at: new Date().toISOString(),
      sync_error: null
    })
    .eq('id', id)

  if (error) {
    console.error(`[SyncRepo] Error marking ${table}/${id} as synced:`, error)
    return false
  }
  return true
}

/**
 * Mark record as failed
 */
export async function markFailed(table, id, errorMsg) {
  const { error } = await supabase
    .from(table)
    .update({
      sync_status: 'failed',
      sync_error: errorMsg?.substring(0, 500)
    })
    .eq('id', id)

  if (error) {
    console.error(`[SyncRepo] Error marking ${table}/${id} as failed:`, error)
    return false
  }
  return true
}

/**
 * Mark record as syncing (in progress)
 */
export async function markSyncing(table, id) {
  const { error } = await supabase
    .from(table)
    .update({ sync_status: 'syncing' })
    .eq('id', id)

  return !error
}

/**
 * Reset failed records to pending (for retry)
 */
export async function resetFailedRecords(table) {
  const { data, error } = await supabase
    .from(table)
    .update({ sync_status: 'pending', sync_error: null })
    .eq('sync_status', 'failed')
    .select('id')

  if (error) {
    console.error(`[SyncRepo] Error resetting failed ${table}:`, error)
    return 0
  }

  return data?.length || 0
}

/**
 * Get last sync info from cloud_sync_state
 */
export async function getLastSyncInfo() {
  const { data, error } = await supabase
    .from('cloud_sync_state')
    .select('*')
    .eq('direction', 'to_cloud')
    .order('last_synced_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[SyncRepo] Error getting sync state:', error)
    return null
  }

  // Find the most recent sync
  const lastSync = data?.find(d => d.last_synced_at)
  return lastSync ? {
    lastSyncedAt: lastSync.last_synced_at,
    table: lastSync.table_name,
    successCount: lastSync.last_success_count,
    failedCount: lastSync.last_failed_count
  } : null
}

/**
 * Update sync state for a table
 */
export async function updateSyncState(table, successCount, failedCount, error = null) {
  const { error: updateError } = await supabase
    .from('cloud_sync_state')
    .update({
      last_synced_at: new Date().toISOString(),
      last_success_count: successCount,
      last_failed_count: failedCount,
      last_error: error
    })
    .eq('table_name', table)
    .eq('direction', 'to_cloud')

  if (updateError) {
    console.error(`[SyncRepo] Error updating sync state for ${table}:`, updateError)
  }
}

/**
 * Log sync session
 * @param {object} stats - Sync statistics
 * @param {object} stats.tableDetails - Per-table breakdown { table: { success, failed } }
 */
export async function logSyncSession(stats) {
  const { error } = await supabase
    .from('sync_log')
    .insert({
      sync_type: 'to_cloud',
      started_at: stats.startedAt,
      completed_at: new Date().toISOString(),
      status: stats.failed > 0 ? 'completed_with_errors' : 'completed',
      records_processed: stats.processed,
      records_success: stats.success,
      records_failed: stats.failed,
      tables_synced: stats.tables,
      table_details: stats.tableDetails || null, // JSONB: { inspection_results: { success: 3, failed: 0 }, ... }
      error_message: stats.error,
      triggered_by: stats.triggeredBy || 'manual',
      machine_name: stats.machineName
    })

  if (error) {
    console.error('[SyncRepo] Error logging sync session:', error)
  }
}

export const syncRepo = {
  getPendingCounts,
  getTotalPendingCount,
  getPendingRecords,
  markSynced,
  markFailed,
  markSyncing,
  resetFailedRecords,
  getLastSyncInfo,
  updateSyncState,
  logSyncSession
}

export default syncRepo

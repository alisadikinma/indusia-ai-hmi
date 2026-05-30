# Phase 16b: Sync Logic - Upload to Cloud

## Overview

Implement the core sync logic that uploads pending records from Local PostgreSQL to Supabase Cloud.

## Prerequisites

- Phase 16a completed (sync foundation)
- `sync_lock` table created
- `lib/sync/` core files exist

---

## Task 1: Sync Repo for Pending Records

**File**: `lib/repos/syncRepo.js`

```javascript
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
  const tables = [
    'inspection_results',
    'inspection_defects', 
    'overrides',
    'event_log',
    'inspection_stats'
  ]

  const counts = []

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('sync_status', ['pending', 'failed'])

    if (!error) {
      counts.push({ table, count: count || 0 })
    }
  }

  // Work orders with pending updates
  const { count: woCount } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .eq('sync_status', 'pending')

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
    .in('sync_status', ['pending', 'failed'])
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
```

---

## Task 2: Main Sync Logic

**File**: `lib/sync/syncToCloud.js`

```javascript
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

  // 3. Acquire lock
  const { acquired, lockedBy } = await acquireLock(pcName)
  if (!acquired) {
    return {
      success: false,
      stats,
      error: `Sync in progress by ${lockedBy}`
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
```

---

## Task 3: Update Index Export

**File**: `lib/sync/index.js` (update)

```javascript
/**
 * Sync Module Exports
 */

export { supabaseAdmin, isCloudSyncConfigured, getCloudConfigStatus } from './supabaseAdmin'
export { checkOnlineStatus, quickOnlineCheck } from './onlineCheck'
export { 
  getLockStatus, 
  acquireLock, 
  releaseLock, 
  updateProgress,
  forceReleaseLock,
  getPcName 
} from './syncLock'
export { syncToCloud, getSyncStatus } from './syncToCloud'
```

---

## Verification

Create a test API route or use server action:

**File**: `app/api/sync/test/route.js` (temporary for testing)

```javascript
import { NextResponse } from 'next/server'
import { syncToCloud, getSyncStatus } from '@/lib/sync'

export async function GET() {
  const status = await getSyncStatus()
  return NextResponse.json(status)
}

export async function POST() {
  const result = await syncToCloud({
    triggeredBy: 'test',
    onProgress: (p) => console.log(`Progress: ${p.current}/${p.total} - ${p.table}`)
  })
  return NextResponse.json(result)
}
```

Test:
```bash
# Get status
curl http://localhost:3000/api/sync/test

# Trigger sync
curl -X POST http://localhost:3000/api/sync/test
```

---

## Files Created/Updated

```
lib/
├── repos/
│   └── syncRepo.js        ← NEW
└── sync/
    ├── index.js           ← UPDATED
    └── syncToCloud.js     ← NEW

app/api/sync/test/
└── route.js               ← NEW (temporary)
```

---

## Next Phase

After this phase works, proceed to **Phase 16c: API Endpoints** for proper sync API routes.

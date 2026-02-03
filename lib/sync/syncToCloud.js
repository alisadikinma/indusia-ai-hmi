/**
 * Sync to Cloud
 *
 * Uploads pending records from Local PostgreSQL to Supabase Cloud.
 * This is the main sync function called by the API.
 */

import { supabaseAdmin, isCloudSyncConfigured } from './supabaseAdmin'
import { acquireLock, releaseLock, updateProgress, getPcName } from './syncLock'
import { checkOnlineStatus } from './onlineCheck'
import { uploadOverrideImages } from './cloudImageUpload'
import syncRepo from '@/lib/repos/syncRepo'
import { supabase } from '@/lib/supabaseClient'

const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE) || 100

// Regex to detect ISO timestamps with timezone offset (e.g. "2026-02-04T06:00:25.641+07:00")
const TZ_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/

/**
 * Strip timezone offset from timestamp strings so cloud stores local wall-clock time.
 * "2026-02-04T06:00:25.641426+07:00" → "2026-02-04T06:00:25.641426"
 *
 * This ensures the cloud database shows the same date/time as the local edge database,
 * which is important for a single-timezone manufacturing environment.
 */
function stripTimezoneOffsets(record) {
  const result = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && TZ_OFFSET_RE.test(value)) {
      // Remove the +HH:MM or -HH:MM suffix
      result[key] = value.replace(/[+-]\d{2}:\d{2}$/, '')
    } else {
      result[key] = value
    }
  }
  return result
}

// Tables to sync (order matters for FK dependencies)
// NOTE: event_log temporarily excluded due to schema mismatch with cloud
const SYNC_TABLES = [
  'inspection_results',
  'inspection_defects',
  'overrides',
  // 'event_log', // TODO: Fix schema mismatch (created_at vs timestamp)
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
    tableDetails: {}, // Per-table breakdown
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
    
    console.log('[Sync] Pending counts:', pendingCounts)
    console.log('[Sync] Total pending:', totalPending)

    if (totalPending === 0) {
      // Don't log empty sync sessions
      console.log('[Sync] No pending records, skipping')
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
      
      // Store per-table breakdown
      stats.tableDetails[table] = {
        success: result.success,
        failed: result.failed
      }

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
      stats.tableDetails['work_orders'] = {
        success: woResult.success,
        failed: woResult.failed
      }
    }

    // 7. Upload override images to cloud storage
    const imgResult = await syncOverrideImages()
    if (imgResult.processed > 0) {
      stats.tables.push('override_images')
      stats.processed += imgResult.processed
      stats.success += imgResult.success
      stats.failed += imgResult.failed
      stats.tableDetails['override_images'] = {
        success: imgResult.success,
        failed: imgResult.failed
      }
    }

    // 8. Log sync session
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
  const MAX_FAILURES = 3 // Stop after 3 consecutive failures
  let consecutiveFailures = 0

  try {
    // Get pending records in batches
    let records = await syncRepo.getPendingRecords(table, BATCH_SIZE)
    console.log(`[Sync] ${table}: Found ${records.length} pending records`)

    while (records.length > 0 && consecutiveFailures < MAX_FAILURES) {
      for (const record of records) {
        if (consecutiveFailures >= MAX_FAILURES) {
          console.log(`[Sync] ${table}: Stopping after ${MAX_FAILURES} consecutive failures`)
          break
        }
        
        try {
          // Remove sync columns and local-only columns before uploading
          const {
            sync_status, synced_at, sync_error,
            // Local-only columns (not in cloud schema)
            local_image_paths,
            ...rawCloudData
          } = record

          // Strip timezone offsets so cloud stores local wall-clock time
          const cloudData = stripTimezoneOffsets(rawCloudData)

          console.log(`[Sync] ${table}/${record.id}: Uploading...`)

          // Upsert to cloud
          const { error } = await supabaseAdmin
            .from(table)
            .upsert(cloudData, { onConflict: 'id' })

          if (error) {
            console.error(`[Sync] ${table}/${record.id}: Cloud error:`, error)
            throw error
          }

          // Mark as synced
          await syncRepo.markSynced(table, record.id)
          result.success++
          consecutiveFailures = 0 // Reset on success
          console.log(`[Sync] ${table}/${record.id}: Success`)

        } catch (err) {
          console.error(`[Sync] Failed ${table}/${record.id}:`, err.message)
          await syncRepo.markFailed(table, record.id, err.message)
          result.failed++
          consecutiveFailures++
        }

        result.processed++
        await onRecord?.(result.processed, result.processed)
      }

      // Stop if too many failures
      if (consecutiveFailures >= MAX_FAILURES) break
      
      // Get next batch
      records = await syncRepo.getPendingRecords(table, BATCH_SIZE)
    }

  } catch (err) {
    console.error(`[Sync] Error syncing ${table}:`, err)
    result.error = err.message
  }

  console.log(`[Sync] ${table}: Completed - ${result.success} success, ${result.failed} failed`)
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
        const woData = stripTimezoneOffsets({
          completed_qty: record.completed_qty,
          good_qty: record.good_qty,
          ng_qty: record.ng_qty,
          false_call_qty: record.false_call_qty,
          status: record.status,
          started_at: record.started_at,
          completed_at: record.completed_at,
          updated_at: record.updated_at
        })
        const { error } = await supabaseAdmin
          .from('work_orders')
          .update(woData)
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
 * Upload images for approved overrides that have been synced but don't have cloud images yet.
 * Only uploads images for overrides whose records are already in the cloud (sync_status = 'synced').
 */
async function syncOverrideImages() {
  const result = { processed: 0, success: 0, failed: 0 }

  try {
    // Find approved overrides with local images but no cloud images
    const { data: overrides, error: fetchErr } = await supabase
      .from('overrides')
      .select('id, local_image_paths, cloud_image_paths, sync_status')
      .eq('status', 'approved')
      .eq('sync_status', 'synced')
      .not('local_image_paths', 'is', null)
      .order('created_at', { ascending: true })

    if (fetchErr) {
      console.error('[Sync] Failed to fetch overrides for image sync:', fetchErr.message)
      return result
    }

    // Filter: only overrides with empty/missing cloud_image_paths
    const pending = overrides.filter(o => {
      if (!o.cloud_image_paths) return true
      try {
        const cp = typeof o.cloud_image_paths === 'string'
          ? JSON.parse(o.cloud_image_paths) : o.cloud_image_paths
        return (!cp.top || cp.top.length === 0) && (!cp.bottom || cp.bottom.length === 0)
      } catch { return true }
    })

    if (pending.length === 0) {
      console.log('[Sync] No override images to upload')
      return result
    }

    console.log(`[Sync] Uploading images for ${pending.length} overrides...`)

    for (const override of pending) {
      try {
        const localPaths = typeof override.local_image_paths === 'string'
          ? override.local_image_paths : JSON.stringify(override.local_image_paths)

        const uploadResult = await uploadOverrideImages(override.id, localPaths)

        if (uploadResult.success && uploadResult.uploadCount > 0) {
          // Update cloud_image_paths in local DB
          await supabase
            .from('overrides')
            .update({
              cloud_image_paths: JSON.stringify(uploadResult.cloudPaths),
              updated_at: new Date().toISOString()
            })
            .eq('id', override.id)

          // Also update in cloud DB
          await supabaseAdmin
            .from('overrides')
            .update({
              cloud_image_paths: JSON.stringify(uploadResult.cloudPaths),
              updated_at: new Date().toISOString()
            })
            .eq('id', override.id)

          result.success += uploadResult.uploadCount
          console.log(`[Sync] Override ${override.id}: ${uploadResult.uploadCount} images uploaded`)
        } else {
          result.failed++
          console.warn(`[Sync] Override ${override.id}: image upload returned 0 uploads`)
        }
      } catch (err) {
        console.error(`[Sync] Failed to upload images for override ${override.id}:`, err.message)
        result.failed++
      }

      result.processed++
    }

    console.log(`[Sync] Override images: ${result.success} uploaded, ${result.failed} failed`)
  } catch (err) {
    console.error('[Sync] Error syncing override images:', err)
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

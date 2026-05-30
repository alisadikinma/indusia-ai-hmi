/**
 * Sync Lock Management
 *
 * Prevents multiple PCs from syncing simultaneously.
 * Uses sync_lock table with single row pattern.
 */

import { supabase } from '@/lib/supabaseClient'
import os from 'os'

const LOCK_TIMEOUT_MINUTES = parseInt(process.env.SYNC_LOCK_TIMEOUT_MINUTES) || 10

/**
 * Get PC identifier (hostname)
 */
export function getPcName() {
  try {
    return os.hostname()
  } catch {
    return `pc-${Date.now()}`
  }
}

/**
 * Get current lock status
 * @returns {Promise<{locked: boolean, lockedBy?: string, lockedAt?: string, expiresAt?: string, progress?: object}>}
 */
export async function getLockStatus() {
  const { data, error } = await supabase
    .from('sync_lock')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[SyncLock] Error getting lock status:', error)
    return { locked: false, error: error.message }
  }

  // Check if lock is active (not expired)
  const isExpired = data.expires_at && new Date(data.expires_at) < new Date()
  const isLocked = data.locked_by && !isExpired

  return {
    locked: isLocked,
    lockedBy: isLocked ? data.locked_by : null,
    lockedAt: isLocked ? data.locked_at : null,
    expiresAt: isLocked ? data.expires_at : null,
    progress: isLocked ? {
      current: data.progress_current || 0,
      total: data.progress_total || 0,
      table: data.current_table
    } : null
  }
}

/**
 * Try to acquire sync lock
 * @param {string} pcName - PC identifier (defaults to hostname)
 * @returns {Promise<{acquired: boolean, lockedBy?: string, error?: string}>}
 */
export async function acquireLock(pcName = getPcName()) {
  // Calculate expiry time
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_TIMEOUT_MINUTES)
  const now = new Date().toISOString()

  console.log('[SyncLock] Attempting to acquire lock for:', pcName)
  console.log('[SyncLock] Current time:', now)

  // First, check current lock status
  const currentLock = await getLockStatus()
  console.log('[SyncLock] Current lock status:', currentLock)

  // If already locked by someone else and not expired, fail
  if (currentLock.locked && currentLock.lockedBy !== pcName) {
    return {
      acquired: false,
      lockedBy: currentLock.lockedBy,
      expiresAt: currentLock.expiresAt
    }
  }

  // Try to acquire lock (unconditionally if not locked or same PC)
  const { data, error } = await supabase
    .from('sync_lock')
    .update({
      locked_by: pcName,
      locked_at: now,
      expires_at: expiresAt.toISOString(),
      sync_type: 'to_cloud',
      progress_current: 0,
      progress_total: 0,
      current_table: null
    })
    .eq('id', 1)
    .select()

  console.log('[SyncLock] Update result:', { data, error })

  if (error) {
    console.error('[SyncLock] Error acquiring lock:', error)
    return { acquired: false, error: error.message }
  }

  if (data && data.length > 0) {
    console.log(`[SyncLock] Lock acquired by ${pcName}`)
    return { acquired: true }
  }

  return { acquired: false, error: 'Failed to update lock row' }
}

/**
 * Release sync lock
 * @param {string} pcName - Only release if locked by this PC
 */
export async function releaseLock(pcName = getPcName()) {
  const { error } = await supabase
    .from('sync_lock')
    .update({
      locked_by: null,
      locked_at: null,
      expires_at: null,
      sync_type: null,
      progress_current: 0,
      progress_total: 0,
      current_table: null
    })
    .eq('id', 1)
    .eq('locked_by', pcName)

  if (error) {
    console.error('[SyncLock] Error releasing lock:', error)
    return { released: false, error: error.message }
  }

  console.log(`[SyncLock] Lock released by ${pcName}`)
  return { released: true }
}

/**
 * Update sync progress (while holding lock)
 */
export async function updateProgress(current, total, tableName) {
  const { error } = await supabase
    .from('sync_lock')
    .update({
      progress_current: current,
      progress_total: total,
      current_table: tableName
    })
    .eq('id', 1)

  if (error) {
    console.error('[SyncLock] Error updating progress:', error)
  }
}

/**
 * Force release lock (admin only - for stuck locks)
 */
export async function forceReleaseLock() {
  const { error } = await supabase
    .from('sync_lock')
    .update({
      locked_by: null,
      locked_at: null,
      expires_at: null,
      sync_type: null,
      progress_current: 0,
      progress_total: 0,
      current_table: null
    })
    .eq('id', 1)

  if (error) {
    console.error('[SyncLock] Error force releasing lock:', error)
    return { released: false, error: error.message }
  }

  console.log('[SyncLock] Lock force released')
  return { released: true }
}

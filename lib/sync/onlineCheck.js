/**
 * Check if Supabase Cloud is reachable
 *
 * Used to determine if sync should be attempted.
 */

import { supabaseAdmin, isCloudSyncConfigured } from './supabaseAdmin'

/**
 * Check online status by pinging Supabase
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<{online: boolean, latency?: number, error?: string}>}
 */
export async function checkOnlineStatus(timeoutMs = 5000) {
  // Not configured = always offline
  if (!isCloudSyncConfigured()) {
    return {
      online: false,
      error: 'Cloud sync not configured. Check SUPABASE_CLOUD_URL and SUPABASE_SERVICE_KEY.'
    }
  }

  const startTime = Date.now()

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
    })

    // Try to reach Supabase (simple query)
    const queryPromise = supabaseAdmin
      .from('sections')
      .select('id')
      .limit(1)

    // Race between query and timeout
    const { error } = await Promise.race([queryPromise, timeoutPromise])

    if (error) {
      return {
        online: false,
        error: error.message,
        latency: Date.now() - startTime
      }
    }

    return {
      online: true,
      latency: Date.now() - startTime
    }

  } catch (err) {
    return {
      online: false,
      error: err.message,
      latency: Date.now() - startTime
    }
  }
}

/**
 * Quick online check (shorter timeout)
 */
export async function quickOnlineCheck() {
  return checkOnlineStatus(3000)
}

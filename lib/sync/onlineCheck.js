/**
 * Check if Supabase Cloud is reachable
 *
 * Uses HTTP fetch to the Supabase REST endpoint (not a table query)
 * to avoid false "offline" when tables/RLS are misconfigured.
 */

import { isCloudSyncConfigured } from './supabaseAdmin'

/**
 * Check online status by fetching the Supabase REST root
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

  const supabaseUrl = process.env.SUPABASE_CLOUD_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const startTime = Date.now()

  try {
    // Fetch Supabase REST root (returns schema info, no table dependency)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      signal: controller.signal
    })

    clearTimeout(timer)

    // Any HTTP response (even 4xx) means the server is reachable
    return {
      online: true,
      latency: Date.now() - startTime
    }

  } catch (err) {
    return {
      online: false,
      error: err.name === 'AbortError' ? 'Connection timeout' : err.message,
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

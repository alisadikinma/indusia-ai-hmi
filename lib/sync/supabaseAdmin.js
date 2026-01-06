/**
 * Supabase Admin Client for Cloud Sync
 *
 * Server-side only! Uses service role key for full access.
 * Used to upload data from Local PG to Supabase Cloud (backup).
 */

import { createClient } from '@supabase/supabase-js'

const supabaseCloudUrl = process.env.SUPABASE_CLOUD_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Validate configuration
const isConfigured = Boolean(supabaseCloudUrl && supabaseServiceKey)

// Create admin client (only if configured)
export const supabaseAdmin = isConfigured
  ? createClient(supabaseCloudUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

/**
 * Check if cloud sync is configured
 */
export function isCloudSyncConfigured() {
  return isConfigured
}

/**
 * Get cloud config status (for debugging)
 */
export function getCloudConfigStatus() {
  return {
    configured: isConfigured,
    hasUrl: Boolean(supabaseCloudUrl),
    hasKey: Boolean(supabaseServiceKey),
    url: supabaseCloudUrl ? supabaseCloudUrl.substring(0, 30) + '...' : null
  }
}

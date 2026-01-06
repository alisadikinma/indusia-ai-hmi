# Phase 16a: Sync Foundation - Database & Core Library

## Overview

Setup foundation for on-demand sync: database migration and core sync library files.

## Prerequisites

- Local PostgreSQL running with `indusia_db`
- PostgREST running on port 3001
- `.env.local` configured with `SUPABASE_CLOUD_URL` and `SUPABASE_SERVICE_KEY`

---

## Task 1: SQL Migration

**File**: `docs/migrations/016_add_sync_lock.sql`

Execute this SQL on Local PostgreSQL (`indusia_db`) via pgAdmin:

```sql
-- ============================================================================
-- Migration 016: Add Sync Lock Table
-- ============================================================================

-- 1. Create sync_lock table to prevent concurrent syncs
CREATE TABLE IF NOT EXISTS sync_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_by VARCHAR(100),
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    sync_type VARCHAR(20),
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    current_table VARCHAR(50),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with empty lock
INSERT INTO sync_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Add columns to cloud_sync_state if not exists
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_success_count INTEGER DEFAULT 0;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_failed_count INTEGER DEFAULT 0;

-- 3. Create indexes for faster pending records query
CREATE INDEX IF NOT EXISTS idx_inspection_results_sync_pending 
ON inspection_results(sync_status, created_at) 
WHERE sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_overrides_sync_pending 
ON overrides(sync_status, created_at) 
WHERE sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_event_log_sync_pending 
ON event_log(sync_status, created_at) 
WHERE sync_status IN ('pending', 'failed');

-- 4. Verify
SELECT 'sync_lock created' as status, COUNT(*) as rows FROM sync_lock;
```

---

## Task 2: Supabase Admin Client

**File**: `lib/sync/supabaseAdmin.js`

```javascript
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
```

---

## Task 3: Online Check Utility

**File**: `lib/sync/onlineCheck.js`

```javascript
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
```

---

## Task 4: Sync Lock Management

**File**: `lib/sync/syncLock.js`

```javascript
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

  // Try to acquire lock (only if not locked or expired)
  const { data, error } = await supabase
    .from('sync_lock')
    .update({
      locked_by: pcName,
      locked_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      sync_type: 'to_cloud',
      progress_current: 0,
      progress_total: 0,
      current_table: null
    })
    .eq('id', 1)
    .or(`locked_by.is.null,expires_at.lt.${new Date().toISOString()}`)
    .select()

  if (error) {
    console.error('[SyncLock] Error acquiring lock:', error)
    return { acquired: false, error: error.message }
  }

  // Check if we got the lock
  if (!data || data.length === 0) {
    // Lock held by someone else - get current holder
    const status = await getLockStatus()
    return { 
      acquired: false, 
      lockedBy: status.lockedBy,
      expiresAt: status.expiresAt
    }
  }

  console.log(`[SyncLock] Lock acquired by ${pcName}`)
  return { acquired: true }
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
```

---

## Task 5: Index File

**File**: `lib/sync/index.js`

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

// syncToCloud will be added in Phase 16b
```

---

## Verification

After implementation, verify in browser console or API route:

```javascript
import { checkOnlineStatus, getLockStatus, acquireLock, releaseLock } from '@/lib/sync'

// Test online check
const online = await checkOnlineStatus()
console.log('Online status:', online)

// Test lock
const lock = await getLockStatus()
console.log('Lock status:', lock)

// Test acquire/release
const acquired = await acquireLock('TEST-PC')
console.log('Acquired:', acquired)
await releaseLock('TEST-PC')
```

---

## Files Created

```
lib/sync/
├── index.js           ← Exports
├── supabaseAdmin.js   ← Cloud client
├── onlineCheck.js     ← Online detection
└── syncLock.js        ← Lock management

docs/migrations/
└── 016_add_sync_lock.sql
```

---

## Next Phase

After this phase works, proceed to **Phase 16b: Sync Logic** which implements the actual data sync.

# Phase 16c: Sync API Endpoints

## Overview

Create API endpoints to expose sync functionality to the frontend.

## Prerequisites

- Phase 16a & 16b completed
- `lib/sync/` module working
- `lib/repos/syncRepo.js` created

---

## Task 1: Sync Status Endpoint

**File**: `app/api/sync/status/route.js`

```javascript
/**
 * GET /api/sync/status
 * 
 * Returns current sync status including:
 * - Online status
 * - Last sync time
 * - Pending records count
 * - Lock status
 */

import { NextResponse } from 'next/server'
import { getSyncStatus, getLockStatus, isCloudSyncConfigured } from '@/lib/sync'

export async function GET() {
  try {
    // Check if sync is configured
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          online: false,
          message: 'Cloud sync not configured'
        }
      })
    }

    // Get sync status
    const status = await getSyncStatus()
    const lock = await getLockStatus()

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        online: status.online,
        latency: status.latency,
        lastSync: status.lastSync,
        pending: status.pending,
        totalPending: status.totalPending,
        lock: lock.locked ? {
          lockedBy: lock.lockedBy,
          lockedAt: lock.lockedAt,
          expiresAt: lock.expiresAt,
          progress: lock.progress
        } : null
      }
    })

  } catch (error) {
    console.error('[API] Sync status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## Task 2: Online Check Endpoint

**File**: `app/api/sync/check-online/route.js`

```javascript
/**
 * GET /api/sync/check-online
 * 
 * Quick check if Supabase cloud is reachable.
 * Used for connection status indicator.
 */

import { NextResponse } from 'next/server'
import { quickOnlineCheck, isCloudSyncConfigured } from '@/lib/sync'

export async function GET() {
  try {
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          online: false,
          configured: false,
          message: 'Cloud sync not configured'
        }
      })
    }

    const result = await quickOnlineCheck()

    return NextResponse.json({
      success: true,
      data: {
        online: result.online,
        latency: result.latency,
        error: result.error
      }
    })

  } catch (error) {
    console.error('[API] Online check error:', error)
    return NextResponse.json({
      success: true, // Don't fail the request
      data: {
        online: false,
        error: error.message
      }
    })
  }
}
```

---

## Task 3: Trigger Sync Endpoint

**File**: `app/api/sync/trigger/route.js`

```javascript
/**
 * POST /api/sync/trigger
 * 
 * Triggers a sync to cloud. 
 * Returns immediately - sync runs in background.
 * 
 * Body: { triggeredBy?: string }
 */

import { NextResponse } from 'next/server'
import { 
  syncToCloud, 
  checkOnlineStatus, 
  acquireLock, 
  getLockStatus,
  isCloudSyncConfigured,
  getPcName 
} from '@/lib/sync'

// Track active sync (simple in-memory for single instance)
let activeSyncPromise = null

export async function POST(request) {
  try {
    // Check configuration
    if (!isCloudSyncConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Cloud sync not configured'
      }, { status: 400 })
    }

    // Parse body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // No body is fine
    }

    const triggeredBy = body.triggeredBy || 'manual'

    // Check online
    const { online, error: onlineError } = await checkOnlineStatus()
    if (!online) {
      return NextResponse.json({
        success: false,
        error: `Cannot sync: ${onlineError || 'Offline'}`
      }, { status: 503 })
    }

    // Check lock
    const lock = await getLockStatus()
    if (lock.locked) {
      return NextResponse.json({
        success: false,
        error: `Sync already in progress by ${lock.lockedBy}`,
        data: {
          lockedBy: lock.lockedBy,
          expiresAt: lock.expiresAt,
          progress: lock.progress
        }
      }, { status: 409 })
    }

    // Start sync in background (don't await)
    activeSyncPromise = syncToCloud({ triggeredBy })
      .then(result => {
        console.log('[Sync] Completed:', result.stats)
        activeSyncPromise = null
        return result
      })
      .catch(err => {
        console.error('[Sync] Failed:', err)
        activeSyncPromise = null
      })

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      data: {
        startedBy: getPcName(),
        triggeredBy
      }
    })

  } catch (error) {
    console.error('[API] Trigger sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/sync/trigger
 * 
 * Check if sync is currently running on this instance
 */
export async function GET() {
  const lock = await getLockStatus()
  
  return NextResponse.json({
    success: true,
    data: {
      inProgress: lock.locked,
      lockedBy: lock.lockedBy,
      progress: lock.progress
    }
  })
}
```

---

## Task 4: Sync Progress Endpoint

**File**: `app/api/sync/progress/route.js`

```javascript
/**
 * GET /api/sync/progress
 * 
 * Get current sync progress (for polling during sync).
 */

import { NextResponse } from 'next/server'
import { getLockStatus, getPcName } from '@/lib/sync'

export async function GET() {
  try {
    const lock = await getLockStatus()
    const myPcName = getPcName()

    if (!lock.locked) {
      return NextResponse.json({
        success: true,
        data: {
          inProgress: false
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        inProgress: true,
        isMySync: lock.lockedBy === myPcName,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
        progress: {
          current: lock.progress?.current || 0,
          total: lock.progress?.total || 0,
          table: lock.progress?.table,
          percent: lock.progress?.total > 0 
            ? Math.round((lock.progress.current / lock.progress.total) * 100)
            : 0
        }
      }
    })

  } catch (error) {
    console.error('[API] Sync progress error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## Task 5: Force Release Lock (Admin)

**File**: `app/api/sync/force-release/route.js`

```javascript
/**
 * POST /api/sync/force-release
 * 
 * Force release a stuck sync lock.
 * Admin only - should be protected by auth.
 */

import { NextResponse } from 'next/server'
import { forceReleaseLock, getLockStatus } from '@/lib/sync'
import { withAuth } from '@/lib/auth/apiAuth'

async function handlePOST(request) {
  try {
    // Get current lock status first
    const before = await getLockStatus()

    if (!before.locked) {
      return NextResponse.json({
        success: true,
        message: 'No lock to release'
      })
    }

    // Force release
    const result = await forceReleaseLock()

    if (!result.released) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to release lock'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Lock released (was held by ${before.lockedBy})`
    })

  } catch (error) {
    console.error('[API] Force release error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Protect with admin permission
export const POST = withAuth('sync:admin')(handlePOST)
```

---

## Task 6: Sync History Endpoint

**File**: `app/api/sync/history/route.js`

```javascript
/**
 * GET /api/sync/history
 * 
 * Get recent sync history from sync_log table.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 10

    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('sync_type', 'to_cloud')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('[API] Sync history error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/status` | GET | Full sync status |
| `/api/sync/check-online` | GET | Quick online check |
| `/api/sync/trigger` | POST | Start sync |
| `/api/sync/trigger` | GET | Check if syncing |
| `/api/sync/progress` | GET | Get sync progress |
| `/api/sync/force-release` | POST | Admin: release lock |
| `/api/sync/history` | GET | Sync history log |

---

## Verification

Test with curl or browser:

```bash
# Check status
curl http://localhost:3000/api/sync/status

# Check online
curl http://localhost:3000/api/sync/check-online

# Start sync
curl -X POST http://localhost:3000/api/sync/trigger

# Check progress
curl http://localhost:3000/api/sync/progress

# Get history
curl http://localhost:3000/api/sync/history
```

---

## Files Created

```
app/api/sync/
├── status/route.js        ← Sync status
├── check-online/route.js  ← Online check
├── trigger/route.js       ← Start sync
├── progress/route.js      ← Sync progress
├── force-release/route.js ← Admin: force release
└── history/route.js       ← Sync history
```

---

## Delete Test Route

Remove the temporary test route created in Phase 16b:

```
app/api/sync/test/route.js  ← DELETE
```

---

## Next Phase

After this phase works, proceed to **Phase 16d: UI Components** for sync indicator and settings UI.

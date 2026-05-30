# Phase 16d: Sync UI Components

## Overview

Create UI components for sync status indicator and manual sync control.

## Prerequisites

- Phase 16a, 16b, 16c completed
- API endpoints working (`/api/sync/*`)

---

## Task 1: useSync Hook

**File**: `hooks/useSync.js`

```javascript
/**
 * useSync Hook
 * 
 * Manages sync state and provides sync actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const POLL_INTERVAL = 3000 // Poll progress every 3 seconds during sync
const STATUS_REFRESH_INTERVAL = 60000 // Refresh status every minute

export function useSync() {
  const [status, setStatus] = useState({
    configured: true,
    online: null, // null = checking, true = online, false = offline
    latency: null,
    lastSync: null,
    pending: [],
    totalPending: 0,
    lock: null
  })
  const [isChecking, setIsChecking] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  const pollIntervalRef = useRef(null)
  const statusIntervalRef = useRef(null)

  /**
   * Fetch sync status
   */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status')
      const json = await res.json()

      if (json.success) {
        setStatus(json.data)
        setIsSyncing(!!json.data.lock)
        
        if (json.data.lock?.progress) {
          setProgress(json.data.lock.progress)
        }
      }
      setError(null)
    } catch (err) {
      console.error('[useSync] Error fetching status:', err)
      setError(err.message)
    } finally {
      setIsChecking(false)
    }
  }, [])

  /**
   * Quick online check
   */
  const checkOnline = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/check-online')
      const json = await res.json()
      
      if (json.success) {
        setStatus(prev => ({
          ...prev,
          online: json.data.online,
          latency: json.data.latency
        }))
      }
      return json.data?.online
    } catch {
      setStatus(prev => ({ ...prev, online: false }))
      return false
    }
  }, [])

  /**
   * Trigger sync
   */
  const triggerSync = useCallback(async (triggeredBy = 'manual') => {
    setError(null)
    
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy })
      })
      const json = await res.json()

      if (!json.success) {
        setError(json.error)
        return { success: false, error: json.error }
      }

      setIsSyncing(true)
      
      // Start polling progress
      startProgressPolling()

      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  /**
   * Poll sync progress
   */
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/progress')
      const json = await res.json()

      if (json.success) {
        if (!json.data.inProgress) {
          // Sync completed
          setIsSyncing(false)
          setProgress(null)
          stopProgressPolling()
          // Refresh status
          fetchStatus()
        } else {
          setProgress(json.data.progress)
        }
      }
    } catch (err) {
      console.error('[useSync] Error fetching progress:', err)
    }
  }, [fetchStatus])

  /**
   * Start polling progress
   */
  const startProgressPolling = useCallback(() => {
    stopProgressPolling()
    pollIntervalRef.current = setInterval(fetchProgress, POLL_INTERVAL)
  }, [fetchProgress])

  /**
   * Stop polling progress
   */
  const stopProgressPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  /**
   * Force release lock (admin)
   */
  const forceRelease = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/force-release', { method: 'POST' })
      const json = await res.json()

      if (json.success) {
        setIsSyncing(false)
        setProgress(null)
        fetchStatus()
      }

      return json
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [fetchStatus])

  // Initial fetch
  useEffect(() => {
    fetchStatus()

    // Periodic status refresh
    statusIntervalRef.current = setInterval(fetchStatus, STATUS_REFRESH_INTERVAL)

    return () => {
      stopProgressPolling()
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current)
      }
    }
  }, [fetchStatus, stopProgressPolling])

  // If already syncing on mount, start polling
  useEffect(() => {
    if (isSyncing && !pollIntervalRef.current) {
      startProgressPolling()
    }
  }, [isSyncing, startProgressPolling])

  return {
    // Status
    isConfigured: status.configured,
    isOnline: status.online,
    isChecking,
    isSyncing,
    latency: status.latency,
    lastSync: status.lastSync,
    pending: status.pending,
    totalPending: status.totalPending,
    lock: status.lock,
    progress,
    error,

    // Actions
    checkOnline,
    triggerSync,
    forceRelease,
    refreshStatus: fetchStatus
  }
}

export default useSync
```

---

## Task 2: SyncIndicator Component

**File**: `components/sync/SyncIndicator.jsx`

```javascript
/**
 * SyncIndicator
 * 
 * Small indicator in header showing sync status.
 * Click to open sync details/settings.
 */

'use client'

import { useState } from 'react'
import { useSync } from '@/hooks/useSync'
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import SyncSettings from './SyncSettings'

export function SyncIndicator({ className }) {
  const [showSettings, setShowSettings] = useState(false)
  const {
    isConfigured,
    isOnline,
    isChecking,
    isSyncing,
    lastSync,
    totalPending,
    progress,
    lock
  } = useSync()

  // Don't show if not configured
  if (!isConfigured) {
    return null
  }

  // Determine status
  const getStatus = () => {
    if (isChecking) {
      return { icon: Cloud, color: 'text-gray-400', label: 'Checking...' }
    }
    if (!isOnline) {
      return { icon: CloudOff, color: 'text-gray-500', label: 'Offline' }
    }
    if (isSyncing) {
      const percent = progress?.percent || 0
      return { 
        icon: RefreshCw, 
        color: 'text-blue-500', 
        label: `Syncing ${percent}%`,
        spinning: true
      }
    }
    if (lock) {
      return { 
        icon: RefreshCw, 
        color: 'text-orange-500', 
        label: `Sync by ${lock.lockedBy}`,
        spinning: true
      }
    }
    if (totalPending > 0) {
      return { 
        icon: AlertCircle, 
        color: 'text-yellow-500', 
        label: `${totalPending} pending`
      }
    }
    return { icon: Check, color: 'text-green-500', label: 'Synced' }
  }

  const status = getStatus()
  const Icon = status.icon

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSync?.lastSyncedAt) return null
    const date = new Date(lastSync.lastSyncedAt)
    const now = new Date()
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md',
          'hover:bg-indusia-surface/50 transition-colors',
          'text-sm',
          className
        )}
        title={`Sync Status: ${status.label}`}
      >
        <Icon 
          className={cn(
            'w-4 h-4',
            status.color,
            status.spinning && 'animate-spin'
          )} 
        />
        <span className={cn('hidden sm:inline', status.color)}>
          {status.label}
        </span>
        {lastSync && !isSyncing && (
          <span className="hidden md:inline text-indusia-textMuted text-xs">
            {formatLastSync()}
          </span>
        )}
      </button>

      {showSettings && (
        <SyncSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}

export default SyncIndicator
```

---

## Task 3: SyncSettings Component

**File**: `components/sync/SyncSettings.jsx`

```javascript
/**
 * SyncSettings
 * 
 * Modal/panel showing sync details and manual sync control.
 */

'use client'

import { useState, useEffect } from 'react'
import { useSync } from '@/hooks/useSync'
import {
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  History,
  Unlock
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function SyncSettings({ onClose }) {
  const {
    isConfigured,
    isOnline,
    isSyncing,
    latency,
    lastSync,
    pending,
    totalPending,
    progress,
    lock,
    error,
    triggerSync,
    forceRelease,
    refreshStatus
  } = useSync()

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [actionResult, setActionResult] = useState(null)

  // Fetch sync history
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true)
      try {
        const res = await fetch('/api/sync/history?limit=5')
        const json = await res.json()
        if (json.success) {
          setHistory(json.data)
        }
      } catch (err) {
        console.error('Error fetching history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [])

  // Handle sync trigger
  const handleSync = async () => {
    setActionResult(null)
    const result = await triggerSync('manual')
    if (!result.success) {
      setActionResult({ type: 'error', message: result.error })
    } else {
      setActionResult({ type: 'success', message: 'Sync started' })
    }
  }

  // Handle force release
  const handleForceRelease = async () => {
    if (!confirm('Force release sync lock? Only do this if sync is stuck.')) {
      return
    }
    const result = await forceRelease()
    setActionResult({
      type: result.success ? 'success' : 'error',
      message: result.message || result.error
    })
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-indusia-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-indusia-border">
          <h2 className="text-lg font-semibold text-indusia-text">
            Cloud Sync
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-indusia-bg transition-colors"
          >
            <X className="w-5 h-5 text-indusia-textMuted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 bg-indusia-bg rounded-lg">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Cloud className="w-5 h-5 text-green-500" />
              ) : (
                <CloudOff className="w-5 h-5 text-gray-500" />
              )}
              <span className="text-indusia-text">
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
            {latency && (
              <span className="text-sm text-indusia-textMuted">
                {latency}ms
              </span>
            )}
          </div>

          {/* Pending Records */}
          {totalPending > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-500 font-medium">
                  {totalPending} records pending sync
                </span>
              </div>
              <div className="space-y-1 text-sm text-indusia-textMuted">
                {pending.map(p => (
                  <div key={p.table} className="flex justify-between">
                    <span>{p.table}</span>
                    <span>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Progress */}
          {isSyncing && progress && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-blue-500 font-medium">
                  Syncing... {progress.percent}%
                </span>
              </div>
              <div className="w-full bg-indusia-bg rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="text-sm text-indusia-textMuted">
                {progress.current} / {progress.total} • {progress.table}
              </div>
            </div>
          )}

          {/* Lock Info (if locked by another PC) */}
          {lock && !isSyncing && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                  <span className="text-orange-500">
                    Sync by {lock.lockedBy}
                  </span>
                </div>
                <button
                  onClick={handleForceRelease}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Unlock className="w-3 h-3" />
                  Force Release
                </button>
              </div>
            </div>
          )}

          {/* Last Sync */}
          {lastSync && (
            <div className="p-3 bg-indusia-bg rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-indusia-text">Last Sync</span>
              </div>
              <div className="text-sm text-indusia-textMuted">
                {formatDate(lastSync.lastSyncedAt)}
              </div>
              <div className="text-sm text-indusia-textMuted">
                {lastSync.successCount} synced, {lastSync.failedCount} failed
              </div>
            </div>
          )}

          {/* Action Result */}
          {actionResult && (
            <div className={cn(
              'p-3 rounded-lg text-sm',
              actionResult.type === 'error' 
                ? 'bg-red-500/10 text-red-400'
                : 'bg-green-500/10 text-green-400'
            )}>
              {actionResult.message}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Sync History */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-indusia-textMuted" />
              <span className="text-sm text-indusia-textMuted">Recent Syncs</span>
            </div>
            {loadingHistory ? (
              <div className="text-sm text-indusia-textMuted">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-indusia-textMuted">No sync history</div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div 
                    key={h.id}
                    className="flex items-center justify-between p-2 bg-indusia-bg rounded text-sm"
                  >
                    <div>
                      <div className="text-indusia-text">
                        {h.records_success} / {h.records_processed}
                      </div>
                      <div className="text-xs text-indusia-textMuted">
                        {formatDate(h.started_at)}
                      </div>
                    </div>
                    <div className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      h.status === 'completed' 
                        ? 'bg-green-500/20 text-green-400'
                        : h.status === 'completed_with_errors'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    )}>
                      {h.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-indusia-border">
          <button
            onClick={handleSync}
            disabled={!isOnline || isSyncing || !!lock}
            className={cn(
              'w-full py-2 px-4 rounded-lg font-medium transition-colors',
              'flex items-center justify-center gap-2',
              isOnline && !isSyncing && !lock
                ? 'bg-indusia-primary text-white hover:bg-indusia-primary/90'
                : 'bg-indusia-bg text-indusia-textMuted cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SyncSettings
```

---

## Task 4: Export Components

**File**: `components/sync/index.js`

```javascript
export { SyncIndicator } from './SyncIndicator'
export { SyncSettings } from './SyncSettings'
```

---

## Task 5: Add to Header

Find the main header/navbar component and add `<SyncIndicator />`.

**Location**: Search for header component (likely in `components/layout/` or `app/` layout)

**Example integration**:

```javascript
import { SyncIndicator } from '@/components/sync'

// In header component JSX:
<div className="flex items-center gap-4">
  {/* Other header items */}
  <SyncIndicator />
  {/* User menu, etc */}
</div>
```

---

## Task 6: Auto-Check on App Load (Optional)

Add to root layout or main provider to auto-check sync status on app load.

**File**: Could be in a provider or layout component

```javascript
'use client'

import { useEffect } from 'react'
import { useSync } from '@/hooks/useSync'

export function SyncProvider({ children }) {
  const { isOnline, totalPending, triggerSync, checkOnline } = useSync()

  // Auto-check on mount
  useEffect(() => {
    checkOnline()
  }, [checkOnline])

  // Optional: Auto-sync if online and has pending
  useEffect(() => {
    if (isOnline && totalPending > 50) {
      // Lots of pending records, suggest sync
      console.log(`[Sync] ${totalPending} records pending - consider syncing`)
    }
  }, [isOnline, totalPending])

  return children
}
```

---

## Files Created

```
hooks/
└── useSync.js              ← Sync hook

components/sync/
├── index.js                ← Exports
├── SyncIndicator.jsx       ← Header indicator
└── SyncSettings.jsx        ← Settings modal
```

---

## Verification

1. Start the app: `npm run dev`
2. Check header for sync indicator
3. Click indicator to open settings
4. Test "Sync Now" button
5. Verify progress updates during sync
6. Check sync history

---

## Complete Phase 16 Summary

| Phase | Files | Purpose |
|-------|-------|---------|
| 16a | 4 files | Foundation: DB + core lib |
| 16b | 2 files | Sync logic |
| 16c | 6 files | API endpoints |
| 16d | 4 files | UI components |

**Total**: ~16 new files for complete sync feature.

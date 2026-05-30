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

  // Fetch sync history + refresh status on mount
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
    refreshStatus() // Refresh status when popup opens
  }, [refreshStatus])

  // Debug: log lock status
  useEffect(() => {
    console.log('[SyncSettings] lock:', lock, 'isSyncing:', isSyncing, 'pending:', pending, 'totalPending:', totalPending)
  }, [lock, isSyncing, pending, totalPending])

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
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50"
      onClick={onClose}  // Close on backdrop click
    >
      <div 
        className="bg-indusia-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}  // Prevent close when clicking inside
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-indusia-border">
          <h2 className="text-lg font-semibold text-indusia-text">
            Cloud Sync
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="p-2 rounded hover:bg-indusia-bg transition-colors"
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
            {latency !== null && (
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
                {pending
                  .filter(p => p.count > 0)
                  .map(p => {
                    // Friendly table names
                    const tableNames = {
                      'inspection_results': 'Inspections',
                      'inspection_defects': 'Defects',
                      'overrides': 'Overrides',
                      'event_log': 'Event Logs',
                      'inspection_stats': 'Statistics',
                      'work_orders': 'Work Orders'
                    }
                    return (
                      <div key={p.table} className="flex justify-between">
                        <span>{tableNames[p.table] || p.table}</span>
                        <span className="text-yellow-400">{p.count}</span>
                      </div>
                    )
                  })}
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

          {/* Lock Info (if locked - show even if not syncing locally) */}
          {lock && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                  <span className="text-orange-500">
                    Locked by {lock.lockedBy}
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
              {lock.expiresAt && (
                <div className="text-xs text-indusia-textMuted mt-1">
                  Expires: {formatDate(lock.expiresAt)}
                </div>
              )}
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
                {lastSync.tables?.length > 0 && (
                  <span className="ml-1">• {lastSync.tables.join(', ')}</span>
                )}
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
            ) : history.filter(h => h.records_processed > 0).length === 0 ? (
              <div className="text-sm text-indusia-textMuted">No sync history</div>
            ) : (
              <div className="space-y-2">
                {history
                  .filter(h => h.records_processed > 0)  // Hide 0/0 records
                  .map(h => (
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

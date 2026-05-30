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

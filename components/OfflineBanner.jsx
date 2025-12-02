'use client'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

export function OfflineBanner() {
  const { isOnline, wasOffline, resetOfflineFlag } = useNetworkStatus()
  const [showReconnected, setShowReconnected] = useState(false)

  // Show reconnected message briefly when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
        resetOfflineFlag()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline, resetOfflineFlag])

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-indusia-warning text-white text-center py-2 z-50 flex items-center justify-center gap-2 shadow-lg">
        <WifiOff className="w-4 h-4" />
        <span className="font-medium">You are offline.</span>
        <span className="text-white/80">Some features may not work until connection is restored.</span>
      </div>
    )
  }

  // Reconnected banner
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-indusia-pass text-white text-center py-2 z-50 flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-300">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="font-medium">Connection restored!</span>
        <span className="text-white/80">Refreshing data...</span>
      </div>
    )
  }

  return null
}

/**
 * Compact offline indicator for use in headers/navbars
 */
export function OfflineIndicator({ className = '' }) {
  const { isOnline } = useNetworkStatus()

  if (isOnline) return null

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 bg-indusia-warning/10 rounded text-indusia-warning text-xs font-medium ${className}`}>
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  )
}

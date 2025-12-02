import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for monitoring network connectivity status
 * Provides online/offline detection with reconnection events
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  const [lastOnlineAt, setLastOnlineAt] = useState(null)
  const [lastOfflineAt, setLastOfflineAt] = useState(null)

  useEffect(() => {
    // Initialize with actual status on client
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setLastOnlineAt(new Date())

      if (wasOffline) {
        // Dispatch custom event for components to refresh data
        window.dispatchEvent(new CustomEvent('network-restored', {
          detail: { timestamp: new Date() }
        }))

        console.log('[Network] Connection restored')
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
      setLastOfflineAt(new Date())

      // Dispatch custom event for components to handle offline state
      window.dispatchEvent(new CustomEvent('network-lost', {
        detail: { timestamp: new Date() }
      }))

      console.log('[Network] Connection lost')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  // Reset the wasOffline flag
  const resetOfflineFlag = useCallback(() => {
    setWasOffline(false)
  }, [])

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    lastOfflineAt,
    resetOfflineFlag
  }
}

/**
 * Hook for listening to network restore events
 * @param {Function} callback - Called when network is restored
 */
export function useNetworkRestore(callback) {
  useEffect(() => {
    const handleRestore = (event) => {
      callback(event.detail)
    }

    window.addEventListener('network-restored', handleRestore)
    return () => window.removeEventListener('network-restored', handleRestore)
  }, [callback])
}

/**
 * Hook for listening to network lost events
 * @param {Function} callback - Called when network is lost
 */
export function useNetworkLost(callback) {
  useEffect(() => {
    const handleLost = (event) => {
      callback(event.detail)
    }

    window.addEventListener('network-lost', handleLost)
    return () => window.removeEventListener('network-lost', handleLost)
  }, [callback])
}

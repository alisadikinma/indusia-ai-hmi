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

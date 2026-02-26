'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/utils/authFetch'

const STORAGE_KEY = 'indusia_auto_update_interval'

// Interval presets in milliseconds
const INTERVAL_OPTIONS = {
  off: 0,
  hourly: 3600000,    // 1 hour
  daily: 86400000,    // 24 hours
}

/**
 * useSystemUpdate Hook
 *
 * Manages system version and update availability state.
 * Fetches current version on mount; superadmin callers can enable
 * periodic update checks via autoCheck option or auto-update toggle.
 */
export function useSystemUpdate({ autoCheck = false } = {}) {
  const [currentVersion, setCurrentVersion] = useState(null)
  const [buildInfo, setBuildInfo] = useState(null)
  const [latestVersion, setLatestVersion] = useState(null)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [commitsBehind, setCommitsBehind] = useState(0)
  const [changelog, setChangelog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Auto-update interval preference
  const [autoUpdateInterval, setAutoUpdateIntervalState] = useState('off')

  const intervalRef = useRef(null)

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && INTERVAL_OPTIONS[saved] !== undefined) {
        setAutoUpdateIntervalState(saved)
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  /**
   * Set auto-update interval and persist to localStorage
   */
  const setAutoUpdateInterval = useCallback((value) => {
    setAutoUpdateIntervalState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch { /* localStorage unavailable */ }
  }, [])

  /**
   * Fetch current version from /api/system/version
   */
  const fetchCurrentVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/system/version')
      const json = await res.json()

      if (json.success) {
        setCurrentVersion(json.data.version)
        setBuildInfo(json.data)
      }
    } catch (err) {
      console.error('[useSystemUpdate] Error fetching version:', err)
    }
  }, [])

  /**
   * Check for updates via /api/system/check-update
   * Only works for superadmin users (API enforces this)
   */
  const checkForUpdate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await authFetch('/api/system/check-update')
      const json = await res.json()

      if (json.success) {
        const data = json.data
        setCurrentVersion(data.currentVersion)
        setLatestVersion(data.latestVersion)
        setIsUpdateAvailable(data.isUpdateAvailable)
        setCommitsBehind(data.commitsBehind)
        setChangelog(data.changelog || [])

        if (data.error) {
          setError(data.error)
        }
      } else {
        // 403 for non-superadmin, or other errors
        if (res.status !== 403) {
          setError(json.error || 'Failed to check for updates')
        }
      }
    } catch (err) {
      console.error('[useSystemUpdate] Error checking for update:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch current version on mount
  useEffect(() => {
    fetchCurrentVersion()
  }, [fetchCurrentVersion])

  // Auto-check: runs on mount if autoCheck is true, OR based on user toggle preference
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const intervalMs = INTERVAL_OPTIONS[autoUpdateInterval] || 0

    if (autoCheck || intervalMs > 0) {
      // Initial check
      checkForUpdate()
      // Set up recurring interval
      const ms = intervalMs > 0 ? intervalMs : 900000 // 15 min fallback for autoCheck
      intervalRef.current = setInterval(checkForUpdate, ms)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoCheck, autoUpdateInterval, checkForUpdate])

  return {
    currentVersion,
    buildInfo,
    latestVersion,
    isUpdateAvailable,
    commitsBehind,
    changelog,
    loading,
    error,
    checkForUpdate,
    fetchCurrentVersion,
    autoUpdateInterval,
    setAutoUpdateInterval,
    INTERVAL_OPTIONS,
  }
}

export default useSystemUpdate

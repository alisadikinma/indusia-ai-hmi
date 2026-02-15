'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/utils/authFetch'

const CHECK_INTERVAL = 3600000 // 1 hour

/**
 * useSystemUpdate Hook
 *
 * Manages system version and update availability state.
 * Fetches current version on mount; superadmin callers can enable
 * periodic update checks via autoCheck option.
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

  const intervalRef = useRef(null)

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

  // Auto-check interval for superadmin
  useEffect(() => {
    if (autoCheck) {
      checkForUpdate()
      intervalRef.current = setInterval(checkForUpdate, CHECK_INTERVAL)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoCheck, checkForUpdate])

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
  }
}

export default useSystemUpdate

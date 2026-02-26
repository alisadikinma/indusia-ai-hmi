/**
 * useSystemSettings Hook
 * Fetches and manages system-level settings (company name, logo, etc.)
 */

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/utils/authFetch'

export function useSystemSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system-settings')
      const json = await res.json()
      if (json.success) {
        setSettings(json.data || {})
      }
    } catch (err) {
      console.error('[useSystemSettings] fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = useCallback(async (updates) => {
    try {
      const res = await authFetch('/api/system-settings', {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (json.success) {
        setSettings(prev => ({ ...prev, ...updates }))
        return { success: true }
      }
      return { success: false, error: json.error }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  return {
    settings,
    loading,
    error,
    companyName: settings.company_name || '',
    companyLogo: settings.company_logo || null,
    companyAddress: settings.company_address || '',
    companyWebsite: settings.company_website || '',
    companyPhone: settings.company_phone || '',
    companyEmail: settings.company_email || '',
    updateSettings,
    refreshSettings: fetchSettings,
  }
}

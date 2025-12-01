'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Hook for managing AI models
 */
export function useModels() {
  const { user } = useAuth()
  const [models, setModels] = useState([])
  const [activeModel, setActiveModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [modelsRes, activeRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/models/active')
      ])

      const modelsJson = await modelsRes.json()
      const activeJson = await activeRes.json()

      if (modelsJson.success) {
        setModels(modelsJson.data || [])
      }
      if (activeJson.success) {
        setActiveModel(activeJson.data)
      }
    } catch (err) {
      console.error('[useModels] Fetch error:', err)
      setError(err.message || 'Failed to fetch models')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Deploy a model
   * @param {string} modelId - Model ID to deploy
   * @returns {Promise<Object>}
   */
  const deployModel = useCallback(async (modelId) => {
    try {
      const res = await fetch(`/api/models/${modelId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      })

      const json = await res.json()

      if (json.success) {
        // Refresh models list
        await fetchModels()
      }

      return json
    } catch (err) {
      console.error('[useModels.deployModel] Error:', err)
      return { success: false, error: err.message }
    }
  }, [user?.id, fetchModels])

  /**
   * Get download URL for a model
   * @param {string} modelId - Model ID
   * @returns {Promise<string|null>}
   */
  const getDownloadUrl = useCallback(async (modelId) => {
    try {
      const res = await fetch(`/api/models/${modelId}/download`)
      const json = await res.json()
      return json.success ? json.data.url : null
    } catch (err) {
      console.error('[useModels.getDownloadUrl] Error:', err)
      return null
    }
  }, [])

  /**
   * Get model by ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object|null>}
   */
  const getModel = useCallback(async (modelId) => {
    try {
      const res = await fetch(`/api/models/${modelId}`)
      const json = await res.json()
      return json.success ? json.data : null
    } catch (err) {
      console.error('[useModels.getModel] Error:', err)
      return null
    }
  }, [])

  /**
   * Update model status
   * @param {string} modelId - Model ID
   * @param {string} status - New status
   * @returns {Promise<Object>}
   */
  const updateModelStatus = useCallback(async (modelId, status) => {
    try {
      const res = await fetch(`/api/models/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const json = await res.json()

      if (json.success) {
        await fetchModels()
      }

      return json
    } catch (err) {
      console.error('[useModels.updateModelStatus] Error:', err)
      return { success: false, error: err.message }
    }
  }, [fetchModels])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return {
    models,
    activeModel,
    loading,
    error,
    deployModel,
    getDownloadUrl,
    getModel,
    updateModelStatus,
    refreshModels: fetchModels
  }
}

/**
 * Hook for deployment history
 */
export function useDeploymentHistory(limit = 10) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/models/history?limit=${limit}`)
      const json = await res.json()

      if (json.success) {
        setHistory(json.data || [])
      }
    } catch (err) {
      console.error('[useDeploymentHistory] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    history,
    loading,
    error,
    refreshHistory: fetchHistory
  }
}

export default useModels

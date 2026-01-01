/**
 * Dashboard Hooks
 * Hooks for fetching dashboard data from API
 */

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/utils/authFetch'

/**
 * Hook for fetching dashboard summary KPIs
 * @param {Object} params - { sectionId, lineId, refreshInterval }
 */
export function useDashboardSummary({ sectionId, lineId, refreshInterval = 5000 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (sectionId) params.append('section_id', sectionId)
      if (lineId) params.append('line_id', lineId)

      const res = await authFetch(`/api/dashboard/summary?${params}`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      const result = await res.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch summary')
      }
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [sectionId, lineId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook for fetching dashboard trend data
 * @param {Object} params - { sectionId, lineId, days }
 */
export function useDashboardTrend({ sectionId, lineId, days = 7 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const params = new URLSearchParams({ days: days.toString() })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)

        const res = await authFetch(`/api/dashboard/trend?${params}`)
        if (!res.ok) throw new Error('Failed to fetch trend')
        const result = await res.json()
        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error || 'Failed to fetch trend')
        }
        setError(null)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days])

  return { data, loading, error }
}

/**
 * Hook for fetching dashboard pareto data
 * @param {Object} params - { sectionId, lineId, days, limit }
 */
export function useDashboardPareto({ sectionId, lineId, days = 30, limit = 10 }) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          days: days.toString(),
          limit: limit.toString()
        })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)

        const res = await authFetch(`/api/dashboard/pareto?${params}`)
        if (!res.ok) throw new Error('Failed to fetch pareto')
        const result = await res.json()
        if (result.success) {
          setData(result.data)
          setTotal(result.total || 0)
        } else {
          throw new Error(result.error || 'Failed to fetch pareto')
        }
        setError(null)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days, limit])

  return { data, total, loading, error }
}

/**
 * Hook for fetching dashboard heatmap data
 * @param {Object} params - { sectionId, lineId, days }
 */
export function useDashboardHeatmap({ sectionId, lineId, days = 7 }) {
  const [data, setData] = useState([])
  const [maxCount, setMaxCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const params = new URLSearchParams({ days: days.toString() })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)

        const res = await authFetch(`/api/dashboard/heatmap?${params}`)
        if (!res.ok) throw new Error('Failed to fetch heatmap')
        const result = await res.json()
        if (result.success) {
          setData(result.data)
          setMaxCount(result.maxCount || 1)
        } else {
          throw new Error(result.error || 'Failed to fetch heatmap')
        }
        setError(null)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days])

  return { data, maxCount, loading, error }
}

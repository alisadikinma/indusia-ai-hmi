/**
 * Live Inspection Hook
 * Connects to AI Backend SSE and manages inspection state
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createAiBackendService } from '@/lib/services/aiBackendService'

const MAX_HISTORY = 50

/**
 * Hook for live inspection data streaming from AI Backend
 * @param {string} lineId - Line ID to connect to
 * @param {Object} options - Configuration options
 */
export function useLiveInspection(lineId, options = {}) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Inspection state
  const [currentInspection, setCurrentInspection] = useState(null)
  const [history, setHistory] = useState([])

  // Hardware state
  const [hardwareStatus, setHardwareStatus] = useState(null)
  const [runningStatus, setRunningStatus] = useState(null)

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null)

  // Work Order state
  const [workOrderCounters, setWorkOrderCounters] = useState(null)

  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false)
  const [lastConfirmation, setLastConfirmation] = useState(null)

  // Stats
  const [stats, setStats] = useState({ pass: 0, fail: 0, total: 0 })

  // Last heartbeat
  const [lastHeartbeat, setLastHeartbeat] = useState(null)

  // Service ref
  const serviceRef = useRef(null)

  // Initialize service
  useEffect(() => {
    if (!lineId) return

    const service = createAiBackendService(lineId, {
      maxReconnectAttempts: options.maxReconnectAttempts || 10
    })

    serviceRef.current = service

    // Event listeners
    service.on('connected', (data) => {
      setIsConnected(true)
      setIsReconnecting(false)
      setConnectionError(null)
      console.log('[useLiveInspection] Connected:', data)
    })

    service.on('error', (data) => {
      setConnectionError(data.message || 'Connection error')
      if (data.fatal) {
        setIsConnected(false)
        setIsReconnecting(false)
      }
    })

    service.on('reconnecting', (data) => {
      setIsReconnecting(true)
      console.log(`[useLiveInspection] Reconnecting attempt ${data.attempt}`)
    })

    service.on('inspection', (data) => {
      setCurrentInspection(data)
      setHistory(prev => [data, ...prev].slice(0, MAX_HISTORY))

      // Update stats
      setStats(prev => ({
        pass: prev.pass + (data.decision === 'PASS' ? 1 : 0),
        fail: prev.fail + (data.decision === 'FAIL' ? 1 : 0),
        total: prev.total + 1
      }))
    })

    service.on('hardware_status', (data) => {
      setHardwareStatus(data.hardware)
    })

    service.on('running_status', (data) => {
      setRunningStatus(data)
    })

    service.on('session_update', (data) => {
      setSessionInfo(data)
    })

    service.on('work_order_update', (data) => {
      setWorkOrderCounters(data)
      console.log('[useLiveInspection] Work order update:', data)
    })

    service.on('heartbeat', (data) => {
      setLastHeartbeat(data.timestamp || new Date().toISOString())
    })

    // Connect
    service.connect()

    // Cleanup
    return () => {
      service.disconnect()
    }
  }, [lineId, options.maxReconnectAttempts])

  /**
   * Confirm inspection with operator decision
   * @param {string} operatorDecision - 'GOOD' or 'NG'
   * @param {Object} confirmOptions - Additional options (unitId, comment)
   */
  const confirmInspection = useCallback(async (operatorDecision, confirmOptions = {}) => {
    if (!currentInspection || !serviceRef.current) {
      return { success: false, error: 'No inspection to confirm' }
    }

    setIsConfirming(true)

    try {
      const result = await serviceRef.current.postConfirm(
        currentInspection.inspection_id,
        operatorDecision,
        currentInspection.decision,
        confirmOptions
      )

      if (result.success) {
        setLastConfirmation({
          ...result.data,
          timestamp: new Date().toISOString()
        })

        // Clear current inspection after confirmation
        setCurrentInspection(null)
      }

      return result
    } finally {
      setIsConfirming(false)
    }
  }, [currentInspection])

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect()
      serviceRef.current.connect()
    }
  }, [])

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect()
      setIsConnected(false)
    }
  }, [])

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  /**
   * Reset stats
   */
  const resetStats = useCallback(() => {
    setStats({ pass: 0, fail: 0, total: 0 })
  }, [])

  /**
   * Clear current inspection
   */
  const clearCurrentInspection = useCallback(() => {
    setCurrentInspection(null)
  }, [])

  return {
    // Connection
    isConnected,
    isReconnecting,
    connectionError,
    reconnect,
    disconnect,

    // Inspection
    currentInspection,
    history,
    clearHistory,
    clearCurrentInspection,

    // Hardware
    hardwareStatus,
    runningStatus,

    // Session
    sessionInfo,

    // Work Order
    workOrderCounters,

    // Stats
    stats,
    resetStats,
    lastHeartbeat,

    // Actions
    confirmInspection,
    isConfirming,
    lastConfirmation,

    // Service (for advanced usage)
    service: serviceRef.current
  }
}

export default useLiveInspection

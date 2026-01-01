/**
 * Live Inspection Hook
 * Manages SSE connection for real-time inspection data
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook for live inspection data streaming
 * @param {string} lineId - Line ID to connect to
 * @param {Object} options - Configuration options
 */
export function useLiveInspection(lineId, options = {}) {
  const {
    onDetection,
    onConnectionChange,
    maxLogSize = 100,
    autoReconnect = true,
    reconnectDelay = 3000
  } = options

  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [detectionLog, setDetectionLog] = useState([])
  const [stats, setStats] = useState({ pass: 0, fail: 0, review: 0 })
  const [error, setError] = useState(null)
  const [lastHeartbeat, setLastHeartbeat] = useState(null)

  const eventSourceRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (!lineId) return

    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setConnecting(true)
    setError(null)

    try {
      const eventSource = new EventSource(`/api/live/${lineId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('[LiveInspection] SSE connection opened')
        setConnected(true)
        setConnecting(false)
        setError(null)
        reconnectAttemptsRef.current = 0
        onConnectionChange?.(true)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'connected':
              console.log('[LiveInspection] Connected:', data.clientId)
              break

            case 'heartbeat':
              setLastHeartbeat(data.timestamp)
              break

            case 'detection':
              // Update current frame
              setCurrentFrame(data)

              // Add to log (keep limited size)
              setDetectionLog(prev => {
                const newLog = [data, ...prev].slice(0, maxLogSize)
                return newLog
              })

              // Update stats
              if (data.result) {
                setStats(prev => ({
                  ...prev,
                  [data.result]: (prev[data.result] || 0) + 1
                }))
              }

              // Callback
              onDetection?.(data)
              break

            default:
              console.log('[LiveInspection] Unknown message type:', data.type)
          }
        } catch (err) {
          console.error('[LiveInspection] Failed to parse SSE data:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('[LiveInspection] SSE error:', err)
        setConnected(false)
        setConnecting(false)
        setError(new Error('Connection lost'))
        onConnectionChange?.(false)

        eventSource.close()
        eventSourceRef.current = null

        // Auto reconnect with exponential backoff
        if (autoReconnect) {
          const attempts = reconnectAttemptsRef.current
          const delay = Math.min(reconnectDelay * Math.pow(2, attempts), 30000) // Max 30s

          console.log(`[LiveInspection] Reconnecting in ${delay}ms (attempt ${attempts + 1})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        }
      }
    } catch (err) {
      console.error('[LiveInspection] Failed to create EventSource:', err)
      setConnecting(false)
      setError(err)
    }
  }, [lineId, maxLogSize, onDetection, onConnectionChange, autoReconnect, reconnectDelay])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setConnected(false)
    setConnecting(false)
    reconnectAttemptsRef.current = 0
    onConnectionChange?.(false)
  }, [onConnectionChange])

  const clearLog = useCallback(() => {
    setDetectionLog([])
  }, [])

  const resetStats = useCallback(() => {
    setStats({ pass: 0, fail: 0, review: 0 })
  }, [])

  const clearCurrentFrame = useCallback(() => {
    setCurrentFrame(null)
  }, [])

  // Connect on mount / lineId change
  useEffect(() => {
    if (lineId) {
      connect()
    }
    return () => disconnect()
  }, [lineId, connect, disconnect])

  return {
    // Connection state
    connected,
    connecting,
    error,
    lastHeartbeat,

    // Data
    currentFrame,
    detectionLog,
    stats,

    // Actions
    connect,
    disconnect,
    clearLog,
    resetStats,
    clearCurrentFrame
  }
}

export default useLiveInspection

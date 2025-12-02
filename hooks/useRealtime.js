import { useEffect, useRef, useCallback } from 'react'
import * as subscriptions from '@/lib/realtime/subscriptions'

/**
 * Hook for real-time override updates
 * @param {Function} onUpdate - Callback for override changes { eventType, newData, oldData }
 * @param {Object} filters - Optional filters like { section_id: '...' }
 */
export function useRealtimeOverrides(onUpdate, filters = {}) {
  const unsubscribeRef = useRef(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep callback reference fresh
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    unsubscribeRef.current = subscriptions.subscribeToOverrides(
      (eventType, newData, oldData) => {
        onUpdateRef.current({ eventType, newData, oldData })
      },
      filters
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [filters.section_id])
}

/**
 * Hook for real-time notification updates
 * @param {string} userId - User ID to subscribe to
 * @param {Function} onNewNotification - Callback for new notifications
 */
export function useRealtimeNotifications(userId, onNewNotification) {
  const onNewRef = useRef(onNewNotification)

  useEffect(() => {
    onNewRef.current = onNewNotification
  }, [onNewNotification])

  useEffect(() => {
    if (!userId) return

    const unsubscribe = subscriptions.subscribeToNotifications(
      userId,
      (notification) => onNewRef.current(notification)
    )

    return unsubscribe
  }, [userId])
}

/**
 * Hook for real-time system health updates
 * @param {Function} onHealthUpdate - Callback for health events
 */
export function useRealtimeSystemHealth(onHealthUpdate) {
  const onHealthRef = useRef(onHealthUpdate)

  useEffect(() => {
    onHealthRef.current = onHealthUpdate
  }, [onHealthUpdate])

  useEffect(() => {
    const unsubscribe = subscriptions.subscribeToSystemHealth(
      (event) => onHealthRef.current(event)
    )
    return unsubscribe
  }, [])
}

/**
 * Hook for real-time model deployment changes
 * @param {Function} onModelChange - Callback for model updates
 */
export function useRealtimeModels(onModelChange) {
  const onChangeRef = useRef(onModelChange)

  useEffect(() => {
    onChangeRef.current = onModelChange
  }, [onModelChange])

  useEffect(() => {
    const unsubscribe = subscriptions.subscribeToModelChanges(
      (model) => onChangeRef.current(model)
    )
    return unsubscribe
  }, [])
}

/**
 * Hook for real-time event log updates
 * @param {Function} onNewEvent - Callback for new events
 * @param {Object} filters - Optional filters like { type: 'ERROR' }
 */
export function useRealtimeEventLog(onNewEvent, filters = {}) {
  const onEventRef = useRef(onNewEvent)

  useEffect(() => {
    onEventRef.current = onNewEvent
  }, [onNewEvent])

  useEffect(() => {
    const unsubscribe = subscriptions.subscribeToEventLog(
      (event) => onEventRef.current(event),
      filters
    )
    return unsubscribe
  }, [filters.type])
}

/**
 * Generic hook for managing realtime subscription with reconnection logic
 * @param {Function} subscribeFn - Subscription function to call
 * @param {Array} deps - Dependencies array for re-subscribing
 * @param {Object} options - Options for reconnection behavior
 */
export function useRealtimeSubscription(subscribeFn, deps = [], options = {}) {
  const {
    enabled = true,
    retryOnError = true,
    retryDelay = 5000,
    maxRetries = 3
  } = options

  const unsubscribeRef = useRef(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef(null)

  const subscribe = useCallback(() => {
    if (!enabled) return

    try {
      unsubscribeRef.current = subscribeFn()
      retryCountRef.current = 0
    } catch (error) {
      console.error('[Realtime] Subscription error:', error)

      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++
        console.log(`[Realtime] Retrying in ${retryDelay}ms (attempt ${retryCountRef.current}/${maxRetries})`)
        retryTimeoutRef.current = setTimeout(subscribe, retryDelay)
      }
    }
  }, [enabled, subscribeFn, retryOnError, retryDelay, maxRetries])

  useEffect(() => {
    subscribe()

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [subscribe, ...deps])
}

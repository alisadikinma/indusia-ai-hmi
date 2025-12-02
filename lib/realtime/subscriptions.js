import { supabase } from '@/lib/supabaseClient'

/**
 * Subscribe to override changes (for Manager queue)
 * @param {Function} callback - Called with (eventType, newData, oldData)
 * @param {Object} filters - Optional filters like { section_id: '...' }
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOverrides(callback, filters = {}) {
  const channel = supabase
    .channel('overrides-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'overrides',
        filter: filters.section_id
          ? `section_id=eq.${filters.section_id}`
          : undefined
      },
      (payload) => {
        callback(payload.eventType, payload.new, payload.old)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to overrides changes')
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Error subscribing to overrides')
      }
    })

  return () => {
    console.log('[Realtime] Unsubscribing from overrides changes')
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to notifications (for current user)
 * @param {string} userId - User ID to filter notifications
 * @param {Function} callback - Called with new notification data
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(userId, callback) {
  if (!userId) {
    console.warn('[Realtime] No userId provided for notification subscription')
    return () => {}
  }

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to notifications for user:', userId)
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Error subscribing to notifications')
      }
    })

  return () => {
    console.log('[Realtime] Unsubscribing from notifications')
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to system health events
 * @param {Function} callback - Called with new system event data
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSystemHealth(callback) {
  const channel = supabase
    .channel('system-health')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'system_events'
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to system health events')
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Error subscribing to system health')
      }
    })

  return () => {
    console.log('[Realtime] Unsubscribing from system health')
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to model deployment changes
 * @param {Function} callback - Called with updated model data
 * @returns {Function} Unsubscribe function
 */
export function subscribeToModelChanges(callback) {
  const channel = supabase
    .channel('model-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ai_models',
        filter: 'is_active=eq.true'
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to model changes')
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Error subscribing to model changes')
      }
    })

  return () => {
    console.log('[Realtime] Unsubscribing from model changes')
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to event log updates
 * @param {Function} callback - Called with new event log data
 * @param {Object} filters - Optional filters like { type: 'ERROR' }
 * @returns {Function} Unsubscribe function
 */
export function subscribeToEventLog(callback, filters = {}) {
  const channel = supabase
    .channel('event-log-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'event_log',
        filter: filters.type
          ? `type=eq.${filters.type}`
          : undefined
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to event log')
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Error subscribing to event log')
      }
    })

  return () => {
    console.log('[Realtime] Unsubscribing from event log')
    supabase.removeChannel(channel)
  }
}

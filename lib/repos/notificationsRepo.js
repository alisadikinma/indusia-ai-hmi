/**
 * Notifications Repository
 * Handles user notifications operations
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List notifications for a user with filters
 * @param {string} userId - User ID
 * @param {Object} filters - { read, type, severity, page, limit }
 * @returns {Promise<{ data?: Array, total?: number, error?: string }>}
 */
export async function list(userId, filters = {}) {
  try {
    const { page = 1, limit = 50 } = filters
    const offset = (page - 1) * limit

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (filters.read !== undefined) {
      query = query.eq('read', filters.read)
    }
    if (filters.type) {
      query = query.eq('type', filters.type)
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: toCamelCase(data), total: count }
  } catch (error) {
    return handleError(error, 'notificationsRepo.list')
  }
}

/**
 * Mark notification as read
 * @param {string} id - Notification ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function markAsRead(id) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'notificationsRepo.markAsRead')
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function markAllAsRead(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error
    return { data: true }
  } catch (error) {
    return handleError(error, 'notificationsRepo.markAllAsRead')
  }
}

/**
 * Create new notification
 * @param {Object} notificationData - { userId, type, severity, category, title, message, metadata }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(notificationData) {
  try {
    const dbData = toSnakeCase({
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })

    const { data, error } = await supabase
      .from('notifications')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'notificationsRepo.create')
  }
}

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<{ data?: number, error?: string }>}
 */
export async function getUnreadCount(userId) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error
    return { data: count || 0 }
  } catch (error) {
    return handleError(error, 'notificationsRepo.getUnreadCount')
  }
}

/**
 * Delete notification
 * @param {string} id - Notification ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function remove(id) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { data: true }
  } catch (error) {
    return handleError(error, 'notificationsRepo.delete')
  }
}

export default {
  list,
  markAsRead,
  markAllAsRead,
  create,
  getUnreadCount,
  delete: remove
}

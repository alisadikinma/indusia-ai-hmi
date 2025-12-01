/**
 * Event Log Repository
 * Handles system event logging operations
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List events with filters and pagination
 * @param {Object} filters - { type, source, userId, from, to, page, limit }
 * @returns {Promise<{ data?: Array, total?: number, error?: string }>}
 */
export async function list(filters = {}) {
  try {
    const { page = 1, limit = 50 } = filters
    const offset = (page - 1) * limit

    let query = supabase
      .from('event_log')
      .select('*', { count: 'exact' })

    if (filters.type) {
      query = query.eq('type', filters.type)
    }
    if (filters.source) {
      query = query.eq('source', filters.source)
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }
    if (filters.from) {
      query = query.gte('created_at', filters.from)
    }
    if (filters.to) {
      query = query.lte('created_at', filters.to)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: toCamelCase(data), total: count }
  } catch (error) {
    return handleError(error, 'eventLogRepo.list')
  }
}

/**
 * Create new event log entry
 * @param {Object} eventData - { type, source, userId, userName, details, metadata }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(eventData) {
  try {
    const dbData = toSnakeCase({
      ...eventData,
      createdAt: new Date().toISOString()
    })

    const { data, error } = await supabase
      .from('event_log')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'eventLogRepo.create')
  }
}

/**
 * Get event by ID
 * @param {string} id - Event ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('event_log')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'eventLogRepo.getById')
  }
}

/**
 * Get events by type
 * @param {string} type - Event type
 * @param {number} limit - Max results
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getByType(type, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('event_log')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'eventLogRepo.getByType')
  }
}

export default {
  list,
  create,
  getById,
  getByType
}

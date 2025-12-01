/**
 * Overrides Repository
 * Handles false call override submissions and reviews
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List overrides with filters
 * @param {Object} filters - { status, sectionId, customerId, from, to, page, limit }
 * @returns {Promise<{ data?: Array, total?: number, error?: string }>}
 */
export async function list(filters = {}) {
  try {
    const { page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit

    let query = supabase
      .from('overrides')
      .select('*', { count: 'exact' })

    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
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
    return handleError(error, 'overridesRepo.list')
  }
}

/**
 * Get override by ID with related data
 * @param {string} id - Override ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('overrides')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.getById')
  }
}

/**
 * Create new override submission
 * @param {Object} overrideData - Override data (status defaults to 'pending')
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(overrideData) {
  try {
    const dbData = toSnakeCase({
      ...overrideData,
      status: 'pending'
    })

    const { data, error } = await supabase
      .from('overrides')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.create')
  }
}

/**
 * Approve override
 * @param {string} id - Override ID
 * @param {string} reviewerId - Reviewer user ID
 * @param {string} reviewerName - Reviewer name
 * @param {string} notes - Review notes
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function approve(id, reviewerId, reviewerName, notes = '') {
  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewer_name: reviewerName,
        review_notes: notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.approve')
  }
}

/**
 * Reject override
 * @param {string} id - Override ID
 * @param {string} reviewerId - Reviewer user ID
 * @param {string} reviewerName - Reviewer name
 * @param {string} notes - Rejection reason
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function reject(id, reviewerId, reviewerName, notes = '') {
  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewer_name: reviewerName,
        review_notes: notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.reject')
  }
}

/**
 * Get override statistics by status
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getStats() {
  try {
    const { data, error } = await supabase
      .from('overrides')
      .select('status')

    if (error) throw error

    const stats = data.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      acc.total = (acc.total || 0) + 1
      return acc
    }, { pending: 0, approved: 0, rejected: 0, total: 0 })

    return { data: stats }
  } catch (error) {
    return handleError(error, 'overridesRepo.getStats')
  }
}

export default {
  list,
  getById,
  create,
  approve,
  reject,
  getStats
}

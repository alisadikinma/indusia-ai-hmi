/**
 * Users Repository
 * Handles all database operations for users table
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List users with optional filters
 * @param {Object} filters - { role, section, status }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function list(filters = {}) {
  try {
    let query = supabase.from('users').select('*')

    if (filters.role) {
      query = query.eq('role', filters.role)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.section) {
      query = query.contains('sections', [filters.section])
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.list')
  }
}

/**
 * Get user by ID
 * @param {string} id - User ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.getById')
  }
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.getByEmail')
  }
}

/**
 * Create new user
 * @param {Object} userData - User data in camelCase
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(userData) {
  try {
    const dbData = toSnakeCase(userData)
    const { data, error } = await supabase
      .from('users')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.create')
  }
}

/**
 * Update user by ID
 * @param {string} id - User ID
 * @param {Object} userData - Fields to update in camelCase
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function update(id, userData) {
  try {
    const dbData = toSnakeCase(userData)
    const { data, error } = await supabase
      .from('users')
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.update')
  }
}

/**
 * Soft delete user (set status to 'disabled')
 * @param {string} id - User ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function remove(id) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ status: 'disabled' })
      .eq('id', id)

    if (error) throw error
    return { data: true }
  } catch (error) {
    return handleError(error, 'usersRepo.delete')
  }
}

export default {
  list,
  getById,
  getByEmail,
  create,
  update,
  delete: remove
}

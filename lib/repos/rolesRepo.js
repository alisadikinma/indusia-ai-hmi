/**
 * Roles Repository
 * Handles all database operations for roles table
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List all roles
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function list() {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'rolesRepo.list')
  }
}

/**
 * Get role by ID
 * @param {string} id - Role ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'rolesRepo.getById')
  }
}

/**
 * Create new role
 * @param {Object} roleData - Role data
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(roleData) {
  try {
    const dbData = toSnakeCase(roleData)
    const { data, error } = await supabase
      .from('roles')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'rolesRepo.create')
  }
}

/**
 * Update role by ID
 * @param {string} id - Role ID
 * @param {Object} roleData - Fields to update
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function update(id, roleData) {
  try {
    const dbData = toSnakeCase(roleData)
    const { data, error } = await supabase
      .from('roles')
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'rolesRepo.update')
  }
}

/**
 * Delete role by ID
 * @param {string} id - Role ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function remove(id) {
  try {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { data: true }
  } catch (error) {
    return handleError(error, 'rolesRepo.delete')
  }
}

export default {
  list,
  getById,
  create,
  update,
  delete: remove
}

/**
 * Defect Classes Repository
 * Handles defect class master data
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * Get all defect classes
 * @param {boolean} activeOnly - Filter for active classes only
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getAll(activeOnly = true) {
  try {
    let query = supabase.from('defect_classes').select('*')
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.getAll')
  }
}

/**
 * Get defect class by code
 * @param {string} code - Defect class code
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getByCode(code) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('*')
      .eq('code', code)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.getByCode')
  }
}

/**
 * Get defect class by ID
 * @param {string} id - Defect class ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.getById')
  }
}

/**
 * Create new defect class
 * @param {Object} defectClassData - { code, name, severity, color }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create({ code, name, severity, color }) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .insert({ code, name, severity, color })
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.create')
  }
}

/**
 * Update defect class
 * @param {string} id - Defect class ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function update(id, updateData) {
  try {
    const dbData = toSnakeCase(updateData)
    const { data, error } = await supabase
      .from('defect_classes')
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.update')
  }
}

/**
 * Toggle defect class active status
 * @param {string} id - Defect class ID
 * @param {boolean} is_active - Active status
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function toggleActive(id, is_active) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'defectClassesRepo.toggleActive')
  }
}

export default {
  getAll,
  getByCode,
  getById,
  create,
  update,
  toggleActive
}

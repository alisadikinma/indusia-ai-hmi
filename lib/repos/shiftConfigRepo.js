/**
 * Shift Config Repository
 * Handles shift time configuration
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Get all shift configs
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getAll() {
  try {
    const { data, error } = await supabase
      .from('shift_config')
      .select('*')
      .order('shift_number', { ascending: true })

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'shiftConfigRepo.getAll')
  }
}

/**
 * Get shift config by section
 * @param {string} section_id - Section ID
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getBySection(section_id) {
  try {
    const { data, error } = await supabase
      .from('shift_config')
      .select('*')
      .eq('section_id', section_id)
      .eq('is_active', true)
      .order('shift_number', { ascending: true })

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'shiftConfigRepo.getBySection')
  }
}

/**
 * Get current active shift for a section
 * @param {string} section_id - Section ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getCurrentShift(section_id) {
  try {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8) // HH:MM:SS

    const { data, error } = await supabase
      .from('shift_config')
      .select('*')
      .eq('section_id', section_id)
      .eq('is_active', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
    return { data: data ? toCamelCase(data) : null }
  } catch (error) {
    return handleError(error, 'shiftConfigRepo.getCurrentShift')
  }
}

/**
 * Upsert shift config
 * @param {Object} shiftData - { section_id, shift_number, start_time, end_time, is_active }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function upsert({ section_id, shift_number, start_time, end_time, is_active = true }) {
  try {
    const { data, error } = await supabase
      .from('shift_config')
      .upsert(
        { section_id, shift_number, start_time, end_time, is_active },
        { onConflict: 'section_id,shift_number' }
      )
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'shiftConfigRepo.upsert')
  }
}

export default {
  getAll,
  getBySection,
  getCurrentShift,
  upsert
}

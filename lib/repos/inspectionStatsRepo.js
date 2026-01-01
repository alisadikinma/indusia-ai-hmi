/**
 * Inspection Stats Repository
 * Handles aggregated inspection statistics per shift
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * Upsert inspection stats
 * @param {Object} data - Inspection stats data
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function upsert(data) {
  try {
    const dbData = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from('inspection_stats')
      .upsert(dbData, { onConflict: 'shift_date,shift_number,line_id' })
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(result) }
  } catch (error) {
    return handleError(error, 'inspectionStatsRepo.upsert')
  }
}

/**
 * Get inspection stats by shift
 * @param {Object} params - { line_id, shift_date, shift_number }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getByShift({ line_id, shift_date, shift_number }) {
  try {
    const { data, error } = await supabase
      .from('inspection_stats')
      .select('*')
      .eq('line_id', line_id)
      .eq('shift_date', shift_date)
      .eq('shift_number', shift_number)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
    return { data: data ? toCamelCase(data) : null }
  } catch (error) {
    return handleError(error, 'inspectionStatsRepo.getByShift')
  }
}

/**
 * Increment counters for inspection stats
 * @param {string} line_id - Line ID
 * @param {string} shift_date - Shift date (YYYY-MM-DD)
 * @param {number} shift_number - Shift number
 * @param {Object} increments - { inspected, pass, defect, false_call }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function incrementCounters(line_id, shift_date, shift_number, increments) {
  try {
    // First get current values
    const { data: current } = await getByShift({ line_id, shift_date, shift_number })

    if (!current) {
      // Create new record
      return upsert({
        line_id,
        shift_date,
        shift_number,
        total_inspected: increments.inspected || 0,
        total_pass: increments.pass || 0,
        total_defect: increments.defect || 0,
        total_false_call: increments.false_call || 0
      })
    }

    // Update existing
    const { data, error } = await supabase
      .from('inspection_stats')
      .update({
        total_inspected: current.totalInspected + (increments.inspected || 0),
        total_pass: current.totalPass + (increments.pass || 0),
        total_defect: current.totalDefect + (increments.defect || 0),
        total_false_call: current.totalFalseCall + (increments.false_call || 0)
      })
      .eq('id', current.id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionStatsRepo.incrementCounters')
  }
}

/**
 * Get inspection stats for a date range
 * @param {Object} params - { line_id, section_id, start_date, end_date }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getByDateRange({ line_id, section_id, start_date, end_date }) {
  try {
    let query = supabase
      .from('inspection_stats')
      .select('*')
      .gte('shift_date', start_date)
      .lte('shift_date', end_date)
      .order('shift_date', { ascending: true })
      .order('shift_number', { ascending: true })

    if (line_id) query = query.eq('line_id', line_id)
    if (section_id) query = query.eq('section_id', section_id)

    const { data, error } = await query

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionStatsRepo.getByDateRange')
  }
}

export default {
  upsert,
  getByShift,
  incrementCounters,
  getByDateRange
}

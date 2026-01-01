/**
 * Dashboard Repository
 * Handles dashboard KPIs and analytics data
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Get summary KPIs for today/current shift
 * @param {Object} params - { section_id, line_id, shift_date, shift_number }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getSummary({ section_id, line_id, shift_date, shift_number }) {
  try {
    let query = supabase
      .from('inspection_stats')
      .select('total_inspected, total_pass, total_defect, total_false_call, avg_confidence')

    if (shift_date) query = query.eq('shift_date', shift_date)
    if (shift_number) query = query.eq('shift_number', shift_number)
    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)

    const { data, error } = await query

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'dashboardRepo.getSummary')
  }
}

/**
 * Get trend data for charts (last N days)
 * @param {Object} params - { section_id, line_id, days }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getTrend({ section_id, line_id, days = 7 }) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('inspection_stats')
      .select('shift_date, total_inspected, total_defect, total_pass')
      .gte('shift_date', startDate.toISOString().split('T')[0])
      .order('shift_date', { ascending: true })

    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)

    const { data, error } = await query

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'dashboardRepo.getTrend')
  }
}

/**
 * Get defect pareto data (aggregate from defect_breakdown JSONB)
 * @param {Object} params - { section_id, line_id, days, limit }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getPareto({ section_id, line_id, days = 30, limit = 10 }) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('inspection_stats')
      .select('defect_breakdown')
      .gte('shift_date', startDate.toISOString().split('T')[0])

    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)

    const { data, error } = await query

    if (error) throw error
    return { data }
  } catch (error) {
    return handleError(error, 'dashboardRepo.getPareto')
  }
}

/**
 * Get defect heatmap data (aggregate from defect_locations JSONB)
 * @param {Object} params - { section_id, line_id, days }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getHeatmap({ section_id, line_id, days = 7 }) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('inspection_stats')
      .select('defect_locations')
      .gte('shift_date', startDate.toISOString().split('T')[0])

    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)

    const { data, error } = await query

    if (error) throw error
    return { data }
  } catch (error) {
    return handleError(error, 'dashboardRepo.getHeatmap')
  }
}

/**
 * Get pending overrides count
 * @param {Object} params - { section_id }
 * @returns {Promise<{ data?: number, error?: string }>}
 */
export async function getPendingOverridesCount({ section_id }) {
  try {
    let query = supabase
      .from('overrides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (section_id) query = query.eq('section_id', section_id)

    const { count, error } = await query

    if (error) throw error
    return { data: count }
  } catch (error) {
    return handleError(error, 'dashboardRepo.getPendingOverridesCount')
  }
}

export default {
  getSummary,
  getTrend,
  getPareto,
  getHeatmap,
  getPendingOverridesCount
}

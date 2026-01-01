/**
 * Inspection Frames Repository
 * Handles logging and retrieval of individual inspection frames
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Log a new inspection frame
 * @param {Object} data - Frame data
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function log({ line_id, board_id, frame_timestamp, image_path, detections, inference_ms, result }) {
  try {
    const { data, error } = await supabase
      .from('inspection_frames')
      .insert({
        line_id,
        board_id,
        frame_timestamp: frame_timestamp || new Date().toISOString(),
        image_path,
        detections,
        inference_ms,
        result
      })
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.log')
  }
}

/**
 * Get recent inspection frames for a line
 * @param {string} line_id - Line ID
 * @param {number} limit - Maximum number of frames
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getRecent(line_id, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('inspection_frames')
      .select('*')
      .eq('line_id', line_id)
      .order('frame_timestamp', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.getRecent')
  }
}

/**
 * Get inspection frames by result type
 * @param {string} line_id - Line ID
 * @param {string} result - Result type ('pass', 'fail', 'review')
 * @param {number} limit - Maximum number of frames
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getByResult(line_id, result, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('inspection_frames')
      .select('*')
      .eq('line_id', line_id)
      .eq('result', result)
      .order('frame_timestamp', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.getByResult')
  }
}

/**
 * Get frame statistics for a line
 * @param {string} line_id - Line ID
 * @param {string} since - ISO timestamp to filter from
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getStats(line_id, since = null) {
  try {
    let query = supabase
      .from('inspection_frames')
      .select('result')
      .eq('line_id', line_id)

    if (since) {
      query = query.gte('frame_timestamp', since)
    }

    const { data, error } = await query

    if (error) throw error

    const stats = { pass: 0, fail: 0, review: 0, total: 0 }
    data.forEach(frame => {
      if (stats[frame.result] !== undefined) {
        stats[frame.result]++
      }
      stats.total++
    })

    return { data: stats }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.getStats')
  }
}

/**
 * Get a single frame by ID
 * @param {string} id - Frame ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('inspection_frames')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.getById')
  }
}

/**
 * Get frames within a time range
 * @param {string} line_id - Line ID
 * @param {string} start - Start timestamp
 * @param {string} end - End timestamp
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getByTimeRange(line_id, start, end) {
  try {
    const { data, error } = await supabase
      .from('inspection_frames')
      .select('*')
      .eq('line_id', line_id)
      .gte('frame_timestamp', start)
      .lte('frame_timestamp', end)
      .order('frame_timestamp', { ascending: true })

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'inspectionFramesRepo.getByTimeRange')
  }
}

export default {
  log,
  getRecent,
  getByResult,
  getStats,
  getById,
  getByTimeRange
}

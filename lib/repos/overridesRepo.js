/**
 * Overrides Repository
 * Handles false call override submissions and reviews
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

/**
 * List overrides with filters
 * @param {Object} filters - { status, sectionId, customerId, from, to, page, limit }
 * @returns {Promise<{ data?: Array, total?: number, error?: string }>}
 */
export async function list(filters = {}) {
  // Return empty if Supabase not configured
  if (!isSupabaseConfigured) {
    return { data: [], total: 0 }
  }

  try {
    const { page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit

    let query = supabase
      .from('overrides')
      .select('*', { count: 'exact' })

    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.sectionIds && filters.sectionIds.length > 0) {
      query = query.in('section_id', filters.sectionIds)
    } else if (filters.sectionId) {
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
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

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
 * @returns {Promise<{ data?: Object, error?: string, duplicate?: boolean }>}
 */
export async function create(overrideData) {
  if (!isSupabaseConfigured) {
    // Return mock success for dev mode
    const mockId = `ovr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    return { 
      data: { 
        id: mockId, 
        ...overrideData, 
        status: 'pending',
        createdAt: new Date().toISOString() 
      } 
    }
  }

  try {
    // Check for duplicate - same board_id within same work order, only if still pending
    if (overrideData.board_id) {
      let dupQuery = supabase
        .from('overrides')
        .select('id, board_id, status, reason, created_at')
        .eq('board_id', overrideData.board_id)
        .eq('status', 'pending')

      // Scope duplicate check to same work order (prevents false positives across WOs/sessions)
      if (overrideData.work_order_id) {
        dupQuery = dupQuery.eq('work_order_id', overrideData.work_order_id)
      }

      const { data: existing, error: checkError } = await dupQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // If column doesn't exist (PGRST204), fall back to board_id-only check
      if (checkError?.code === 'PGRST204' && overrideData.work_order_id) {
        const { data: fallback } = await supabase
          .from('overrides')
          .select('id, board_id, status, reason, created_at')
          .eq('board_id', overrideData.board_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (fallback) {
          return { data: toCamelCase(fallback), duplicate: true }
        }
      } else if (!checkError && existing) {
        return {
          data: toCamelCase(existing),
          duplicate: true
        }
      }
    }

    // Generate ID if not provided
    const id = overrideData.id || `ovr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

    const dbData = toSnakeCase({
      id,
      ...overrideData,
      status: overrideData.status || 'pending',
      sync_status: 'pending',
      created_at: new Date().toISOString()
    })

    let { data, error } = await supabase
      .from('overrides')
      .insert(dbData)
      .select()
      .single()

    // Retry without work_order_id if column doesn't exist yet (migration not run)
    if (error?.code === 'PGRST204' && dbData.work_order_id) {
      const { work_order_id, ...fallbackData } = dbData
      ;({ data, error } = await supabase
        .from('overrides')
        .insert(fallbackData)
        .select()
        .single())
    }

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.create')
  }
}

/**
 * Approve override
 *
 * NOTE: Image upload does NOT happen here. Images are uploaded during
 * cloud sync (syncToCloud → syncOverrideImages). This keeps approval
 * fast since it only touches the local database.
 *
 * @param {string} id - Override ID
 * @param {string} reviewerId - Reviewer user ID
 * @param {string} reviewerName - Reviewer name
 * @param {string} notes - Review notes
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function approve(id, reviewerId, reviewerName, notes = '') {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewer_name: reviewerName,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
        sync_status: 'pending'
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
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewer_name: reviewerName,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
        sync_status: 'pending'  // Re-sync after review
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
 * Review override with per-frame decisions
 * Manager approves/rejects each NG frame individually
 * @param {string} id - Override ID
 * @param {string} reviewerId - Reviewer user ID
 * @param {string} reviewerName - Reviewer name
 * @param {Object} frameDecisions - Per-frame decisions { "TOP-0": "approved", "BOTTOM-1": "rejected" }
 * @param {string} notes - Review notes
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function review(id, reviewerId, reviewerName, frameDecisions, notes = '') {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'reviewed',
        reviewed_by: reviewerId,
        reviewer_name: reviewerName,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
        frame_decisions: frameDecisions,
        sync_status: 'pending'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.review')
  }
}

/**
 * Get override statistics by status
 * @param {Object} filters - Optional { sectionIds } to filter by sections
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getStats(filters = {}) {
  if (!isSupabaseConfigured) {
    return { data: { pending: 0, approved: 0, rejected: 0, total: 0 } }
  }

  try {
    let query = supabase
      .from('overrides')
      .select('status')

    // Apply section filter if provided
    if (filters.sectionIds && filters.sectionIds.length > 0) {
      query = query.in('section_id', filters.sectionIds)
    }

    const { data, error } = await query

    if (error) throw error

    const stats = data.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      acc.total = (acc.total || 0) + 1
      return acc
    }, { pending: 0, approved: 0, rejected: 0, reviewed: 0, appealed: 0, total: 0 })

    return { data: stats }
  } catch (error) {
    return handleError(error, 'overridesRepo.getStats')
  }
}

// NOTE: createWithAnnotation, updateAnnotations, getWithImages removed
// - override_images table not created (using sync_queue instead)
// - Functions were dead code (not used anywhere)

/**
 * Update cloud image paths after upload to Supabase Storage
 * @param {string} id - Override ID
 * @param {string} cloudPaths - JSON string of cloud paths
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function updateCloudPaths(id, cloudPaths) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        cloud_image_paths: cloudPaths,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.updateCloudPaths')
  }
}

/**
 * Submit appeal for a reviewed object
 * Stores appeal_decisions JSON on the override record
 * @param {string} id - Override ID
 * @param {Object} appealDecisions - Updated appeal_decisions object
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function submitAppeal(id, appealDecisions) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: 'appealed',
        appeal_decisions: appealDecisions,
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.submitAppeal')
  }
}

/**
 * Resolve an appeal (re_approved or re_rejected)
 * Updates both appeal_decisions and frame_decisions
 * @param {string} id - Override ID
 * @param {Object} appealDecisions - Updated appeal_decisions with resolution
 * @param {Object} frameDecisions - Updated frame_decisions reflecting appeal outcome
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function resolveAppeal(id, appealDecisions, frameDecisions) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    // Check if any appeals still pending
    const hasPendingAppeals = Object.values(appealDecisions).some(
      a => a.status === 'appealed'
    )

    const { data, error } = await supabase
      .from('overrides')
      .update({
        status: hasPendingAppeals ? 'appealed' : 'reviewed',
        appeal_decisions: appealDecisions,
        frame_decisions: frameDecisions,
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.resolveAppeal')
  }
}

export default {
  list,
  getById,
  create,
  updateCloudPaths,
  approve,
  reject,
  review,
  submitAppeal,
  resolveAppeal,
  getStats
}

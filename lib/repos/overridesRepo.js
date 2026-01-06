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
    console.warn('[overridesRepo.list] Supabase not configured, returning empty')
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
    console.warn('[overridesRepo.create] Supabase not configured, returning mock')
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
    // Check for duplicate - same board_id regardless of status
    // This prevents multiple overrides for the same board
    if (overrideData.board_id) {
      const { data: existing, error: checkError } = await supabase
        .from('overrides')
        .select('id, board_id, status, reason, created_at')
        .eq('board_id', overrideData.board_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!checkError && existing) {
        console.warn(`[overridesRepo.create] Duplicate detected for board_id: ${overrideData.board_id} (existing status: ${existing.status}), returning existing`)
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
      created_at: new Date().toISOString()
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
    }, { pending: 0, approved: 0, rejected: 0, total: 0 })

    return { data: stats }
  } catch (error) {
    return handleError(error, 'overridesRepo.getStats')
  }
}

/**
 * Create override with annotation data and images
 * @param {Object} data - Override data with images array
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function createWithAnnotation(data) {
  if (!isSupabaseConfigured) {
    // Return mock success for dev mode
    const mockId = `ovr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    console.warn('[overridesRepo.createWithAnnotation] Supabase not configured, returning mock')
    return { 
      data: { 
        id: mockId, 
        ...data, 
        status: 'pending',
        createdAt: new Date().toISOString() 
      } 
    }
  }

  try {
    const { images, ...overrideData } = data
    const dbData = toSnakeCase({
      ...overrideData,
      status: 'pending'
    })

    // Create override
    const { data: override, error: overrideError } = await supabase
      .from('overrides')
      .insert(dbData)
      .select()
      .single()

    if (overrideError) throw overrideError

    // Create override images with annotations
    if (images?.length) {
      const imageRecords = images.map(img => ({
        override_id: override.id,
        image_path: img.image_path || null,
        image_url: img.image_url,
        ai_detections: img.ai_detections || [],
        annotations: img.annotations || {}
      }))

      const { error: imgError } = await supabase
        .from('override_images')
        .insert(imageRecords)

      if (imgError) {
        console.error('[overridesRepo.createWithAnnotation] Image insert error:', imgError)
        // Return override but note image error
        return { data: toCamelCase(override), imageError: imgError.message }
      }
    }

    return { data: toCamelCase(override) }
  } catch (error) {
    return handleError(error, 'overridesRepo.createWithAnnotation')
  }
}

/**
 * Update annotations for an override image
 * @param {string} imageId - Override image ID
 * @param {Object} annotations - Annotation data
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function updateAnnotations(imageId, annotations) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('override_images')
      .update({ annotations })
      .eq('id', imageId)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.updateAnnotations')
  }
}

/**
 * Get override with images and annotations
 * @param {string} id - Override ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getWithImages(id) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('overrides')
      .select(`
        *,
        override_images (
          id,
          image_path,
          image_url,
          ai_detections,
          annotations
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'overridesRepo.getWithImages')
  }
}

export default {
  list,
  getById,
  create,
  createWithAnnotation,
  updateAnnotations,
  getWithImages,
  approve,
  reject,
  getStats
}

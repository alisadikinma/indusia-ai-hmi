/**
 * Overrides Repository
 * Handles false call override submissions and reviews
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

// Dynamic import for cloud image upload (server-side only)
let uploadOverrideImages = null
if (typeof window === 'undefined') {
  // Server-side only
  import('@/lib/sync/cloudImageUpload').then(mod => {
    uploadOverrideImages = mod.uploadOverrideImages
  }).catch(() => {
    console.warn('[overridesRepo] Cloud image upload not available')
  })
}

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
    if (overrideData.board_id) {
      const { data: existing, error: checkError } = await supabase
        .from('overrides')
        .select('id, board_id, status, reason, created_at')
        .eq('board_id', overrideData.board_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!checkError && existing) {
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
 * @param {boolean} uploadImages - Whether to upload images to cloud storage
 * @returns {Promise<{ data?: Object, error?: string, imageUpload?: Object }>}
 */
export async function approve(id, reviewerId, reviewerName, notes = '', uploadImages = true) {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' }
  }

  try {
    // First get the override to check for local images
    const { data: existing, error: fetchError } = await supabase
      .from('overrides')
      .select('local_image_paths')
      .eq('id', id)
      .single()
    
    if (fetchError) throw fetchError

    // Update override status
    const updateData = {
      status: 'approved',
      reviewed_by: reviewerId,
      reviewer_name: reviewerName,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
      sync_status: 'pending'  // Re-sync after review
    }

    // Upload images to cloud storage if approved and images exist
    let imageUploadResult = null
    if (uploadImages && existing?.local_image_paths && uploadOverrideImages) {
      try {
        console.log(`[overridesRepo.approve] Uploading images for override ${id}...`)
        imageUploadResult = await uploadOverrideImages(id, existing.local_image_paths)
        
        if (imageUploadResult.success && imageUploadResult.cloudPaths) {
          // Store cloud paths in override record
          updateData.cloud_image_paths = JSON.stringify(imageUploadResult.cloudPaths)
          console.log(`[overridesRepo.approve] Uploaded ${imageUploadResult.uploadCount} images to cloud`)
        }
      } catch (imgErr) {
        console.error('[overridesRepo.approve] Image upload failed (non-blocking):', imgErr)
        // Continue with approval even if image upload fails
      }
    }

    const { data, error } = await supabase
      .from('overrides')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { 
      data: toCamelCase(data),
      imageUpload: imageUploadResult
    }
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

export default {
  list,
  getById,
  create,
  updateCloudPaths,
  approve,
  reject,
  getStats
}

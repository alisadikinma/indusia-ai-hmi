/**
 * Dataset Images Repository
 * Manage images for training
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

export const datasetImagesRepo = {
  /**
   * List images with filters
   */
  async list({ datasetId, source, isLabeled, label, page = 1, limit = 20 } = {}) {
    try {
      let query = supabase
        .from('dataset_images')
        .select('*', { count: 'exact' })

      if (source) query = query.eq('source', source)
      if (typeof isLabeled === 'boolean') query = query.eq('is_labeled', isLabeled)

      // If datasetId provided, filter through junction table
      if (datasetId) {
        const { data: imageIds } = await supabase
          .from('training_dataset_images')
          .select('image_id')
          .eq('dataset_id', datasetId)

        const ids = imageIds?.map(r => r.image_id) || []
        if (ids.length === 0) {
          return {
            success: true,
            data: [],
            meta: { total: 0, page, limit }
          }
        }
        query = query.in('id', ids)
      }

      const from = (page - 1) * limit
      query = query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1)

      const { data, error, count } = await query

      if (error) throw error
      return {
        success: true,
        data: data.map(toCamelCase),
        meta: { total: count, page, limit }
      }
    } catch (error) {
      console.error('datasetImagesRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get image by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('dataset_images')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { success: true, data: null }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('datasetImagesRepo.getById error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Create image record
   */
  async create(imageData) {
    try {
      const { data, error } = await supabase
        .from('dataset_images')
        .insert(toSnakeCase(imageData))
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('datasetImagesRepo.create error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Bulk create images
   */
  async bulkCreate(images) {
    try {
      const records = images.map(toSnakeCase)
      const results = { created: 0, failed: 0, errors: [] }

      // Insert in batches of 50
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        const { data, error } = await supabase
          .from('dataset_images')
          .insert(batch)
          .select()

        if (error) {
          results.failed += batch.length
          results.errors.push({ index: i, error: error.message })
        } else {
          results.created += data.length
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error('datasetImagesRepo.bulkCreate error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update image (annotations, labels)
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('dataset_images')
        .update({
          ...toSnakeCase(updates),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('datasetImagesRepo.update error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Delete image
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('dataset_images')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('datasetImagesRepo.delete error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Bulk delete images
   */
  async bulkDelete(ids) {
    try {
      const { error } = await supabase
        .from('dataset_images')
        .delete()
        .in('id', ids)

      if (error) throw error
      return { success: true, data: { deleted: ids.length } }
    } catch (error) {
      console.error('datasetImagesRepo.bulkDelete error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default datasetImagesRepo

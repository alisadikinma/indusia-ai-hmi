/**
 * Sample Images Repository
 * Manage reference/sample images for testing
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

export const sampleImagesRepo = {
  /**
   * List sample images
   */
  async list({ category, boardId, page = 1, limit = 50 } = {}) {
    try {
      let query = supabase
        .from('sample_images')
        .select('*', { count: 'exact' })

      if (category) query = query.eq('category', category)
      if (boardId) query = query.eq('board_id', boardId)

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
      console.error('sampleImagesRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get sample image by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('sample_images')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { success: true, data: null }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('sampleImagesRepo.getById error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Create sample image
   */
  async create(imageData) {
    try {
      const { data, error } = await supabase
        .from('sample_images')
        .insert(toSnakeCase(imageData))
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('sampleImagesRepo.create error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update sample image
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('sample_images')
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
      console.error('sampleImagesRepo.update error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Delete sample image
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('sample_images')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('sampleImagesRepo.delete error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default sampleImagesRepo

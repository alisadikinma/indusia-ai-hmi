/**
 * AI Models Repository
 * CRUD operations for AI model registry
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

export const aiModelsRepo = {
  /**
   * List models with optional filters
   */
  async list({ status, name, page = 1, limit = 20 } = {}) {
    try {
      let query = supabase
        .from('ai_models')
        .select('*', { count: 'exact' })

      if (status) query = query.eq('status', status)
      if (name) query = query.ilike('name', `%${name}%`)

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
      console.error('aiModelsRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get model by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { success: true, data: null }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('aiModelsRepo.getById error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Create new model
   */
  async create(modelData) {
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .insert(toSnakeCase(modelData))
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // Unique violation
          return { success: false, error: 'Model with this name and version already exists', code: 'DUPLICATE' }
        }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('aiModelsRepo.create error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update model
   */
  async update(id, updates) {
    try {
      const updateData = {
        ...toSnakeCase(updates),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('ai_models')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('aiModelsRepo.update error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Delete model
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('ai_models')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('aiModelsRepo.delete error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get active model
   */
  async getActive() {
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { success: true, data: data ? toCamelCase(data) : null }
    } catch (error) {
      console.error('aiModelsRepo.getActive error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default aiModelsRepo

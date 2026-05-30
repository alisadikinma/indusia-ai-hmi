/**
 * AI Models Repository
 * CRUD operations for AI model registry
 * 
 * Schema columns:
 * id, name, version, description, training_job_id, dataset_id, storage_path, public_url,
 * file_size, base_model, framework, map50, map50_95, precision_val, recall,
 * inference_speed_ms, status, is_active, deployed_at, deployed_by, created_by, created_at
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase } from '@/lib/repos'

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
   * Maps camelCase input to actual DB columns
   */
  async create(modelData) {
    try {
      // Explicit mapping to actual column names
      const dbData = {
        name: modelData.name,
        version: modelData.version,
        description: modelData.description || null,
        status: modelData.status || 'draft',
        storage_path: modelData.storagePath || null,
        public_url: modelData.publicUrl || null,
        base_model: modelData.baseModel || null,
        framework: modelData.framework || 'yolov10',
        training_job_id: modelData.trainingJobId || null,
        dataset_id: modelData.datasetId || null,
        created_by: modelData.createdBy || null,
      }

      const { data, error } = await supabase
        .from('ai_models')
        .insert(dbData)
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
      // Explicit mapping
      const dbData = {}
      if (updates.name !== undefined) dbData.name = updates.name
      if (updates.version !== undefined) dbData.version = updates.version
      if (updates.description !== undefined) dbData.description = updates.description
      if (updates.status !== undefined) dbData.status = updates.status
      if (updates.storagePath !== undefined) dbData.storage_path = updates.storagePath
      if (updates.publicUrl !== undefined) dbData.public_url = updates.publicUrl
      if (updates.baseModel !== undefined) dbData.base_model = updates.baseModel
      if (updates.framework !== undefined) dbData.framework = updates.framework
      if (updates.isActive !== undefined) dbData.is_active = updates.isActive
      if (updates.deployedAt !== undefined) dbData.deployed_at = updates.deployedAt
      if (updates.deployedBy !== undefined) dbData.deployed_by = updates.deployedBy

      const { data, error } = await supabase
        .from('ai_models')
        .update(dbData)
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
        .order('created_at', { ascending: false })
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

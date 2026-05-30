/**
 * Training Datasets Repository
 * Manage dataset collections for training
 * 
 * Schema: id, name, description, status, image_count, total_annotations,
 *         section_id, customer_id, created_by, created_at, updated_at
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase } from '@/lib/repos'

export const trainingDatasetsRepo = {
  /**
   * List datasets
   */
  async list({ status, page = 1, limit = 20 } = {}) {
    try {
      let query = supabase
        .from('training_datasets')
        .select('*', { count: 'exact' })

      if (status) query = query.eq('status', status)

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
      console.error('trainingDatasetsRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get dataset by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('training_datasets')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { success: true, data: null }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingDatasetsRepo.getById error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Create dataset
   */
  async create(datasetData) {
    try {
      const insertData = {
        name: datasetData.name,
        description: datasetData.description || null,
        status: datasetData.status || 'draft',
        section_id: datasetData.sectionId || datasetData.section_id || null,
        customer_id: datasetData.customerId || datasetData.customer_id || null,
        created_by: datasetData.createdBy || datasetData.created_by || null
      }

      const { data, error } = await supabase
        .from('training_datasets')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingDatasetsRepo.create error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update dataset
   */
  async update(id, updates) {
    try {
      const updateData = { updated_at: new Date().toISOString() }
      
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.imageCount !== undefined) updateData.image_count = updates.imageCount
      if (updates.totalAnnotations !== undefined) updateData.total_annotations = updates.totalAnnotations

      const { data, error } = await supabase
        .from('training_datasets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingDatasetsRepo.update error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Delete dataset
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('training_datasets')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('trainingDatasetsRepo.delete error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default trainingDatasetsRepo

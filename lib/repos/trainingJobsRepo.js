/**
 * Training Jobs Repository
 * Manage AI training job lifecycle
 * 
 * Schema: id, job_id, dataset_id, status, modal_call_id, config, base_model,
 *         epochs, batch_size, image_size, created_by, created_at, started_at,
 *         completed_at, model_id, error_message
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase } from '@/lib/repos'

export const trainingJobsRepo = {
  /**
   * List training jobs
   */
  async list({ status, datasetId, page = 1, limit = 20 } = {}) {
    try {
      let query = supabase
        .from('training_jobs')
        .select('*', { count: 'exact' })

      if (status) query = query.eq('status', status)
      if (datasetId) query = query.eq('dataset_id', datasetId)

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
      console.error('trainingJobsRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get job by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('training_jobs')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { success: true, data: null }
        throw error
      }
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingJobsRepo.getById error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Create training job
   */
  async create(jobData) {
    try {
      // Generate unique job_id
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      
      const insertData = {
        job_id: jobId,
        dataset_id: jobData.dataset_id || jobData.datasetId,
        status: 'pending',
        config: jobData.config || {},
        base_model: jobData.base_model || jobData.baseModel || 'yolov10n.pt',
        epochs: jobData.config?.epochs || 100,
        batch_size: jobData.config?.batch_size || jobData.config?.batchSize || 16,
        image_size: jobData.config?.image_size || jobData.config?.imageSize || 640,
        created_by: jobData.created_by || jobData.createdBy || null
      }

      const { data, error } = await supabase
        .from('training_jobs')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingJobsRepo.create error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update job status
   */
  async updateStatus(id, updates) {
    try {
      const updateData = {}
      
      if (updates.status) updateData.status = updates.status
      if (updates.errorMessage) updateData.error_message = updates.errorMessage
      if (updates.modalCallId) updateData.modal_call_id = updates.modalCallId
      if (updates.modelId) updateData.model_id = updates.modelId

      // Set timestamps based on status
      if (updates.status === 'running') {
        updateData.started_at = new Date().toISOString()
      }
      if (updates.status === 'completed' || updates.status === 'failed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('training_jobs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingJobsRepo.updateStatus error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Cancel job
   */
  async cancel(id) {
    try {
      const { data: current } = await supabase
        .from('training_jobs')
        .select('status')
        .eq('id', id)
        .single()

      if (['completed', 'cancelled', 'failed'].includes(current?.status)) {
        return { success: false, error: 'Cannot cancel job in terminal state' }
      }

      const { data, error } = await supabase
        .from('training_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingJobsRepo.cancel error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default trainingJobsRepo

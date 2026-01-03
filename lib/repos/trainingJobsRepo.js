/**
 * Training Jobs Repository
 * Manage AI training job lifecycle
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

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
      const { data, error } = await supabase
        .from('training_jobs')
        .insert({
          ...toSnakeCase(jobData),
          status: 'queued',
          progress: 0,
          current_epoch: 0
        })
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
   * Update job status/progress
   */
  async updateStatus(id, updates) {
    try {
      const updateData = toSnakeCase(updates)

      // Set timestamps based on status
      if (updates.status === 'running' && !updates.startedAt) {
        updateData.started_at = new Date().toISOString()
      }
      if (updates.status === 'completed' && !updates.completedAt) {
        updateData.completed_at = new Date().toISOString()
      }
      if (updates.status === 'cancelled' && !updates.cancelledAt) {
        updateData.cancelled_at = new Date().toISOString()
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
      // Only cancel if not already completed/cancelled
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
          cancelled_at: new Date().toISOString()
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

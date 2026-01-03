/**
 * Training Metrics Repository
 * Log and retrieve training metrics per epoch
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

export const trainingMetricsRepo = {
  /**
   * List metrics for job
   */
  async listByJob(jobId) {
    try {
      const { data, error } = await supabase
        .from('training_metrics')
        .select('*')
        .eq('job_id', jobId)
        .order('epoch', { ascending: true })

      if (error) throw error
      return { success: true, data: data.map(toCamelCase) }
    } catch (error) {
      console.error('trainingMetricsRepo.listByJob error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * List all metrics with filters
   */
  async list({ jobId, page = 1, limit = 100 } = {}) {
    try {
      let query = supabase
        .from('training_metrics')
        .select('*', { count: 'exact' })

      if (jobId) query = query.eq('job_id', jobId)

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
      console.error('trainingMetricsRepo.list error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Log single epoch metrics
   */
  async log(metricsData) {
    try {
      const { data, error } = await supabase
        .from('training_metrics')
        .insert(toSnakeCase(metricsData))
        .select()
        .single()

      if (error) throw error
      return { success: true, data: toCamelCase(data) }
    } catch (error) {
      console.error('trainingMetricsRepo.log error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Bulk log metrics (multiple epochs)
   */
  async bulkLog(jobId, metricsArray) {
    try {
      const records = metricsArray.map(m => ({
        ...toSnakeCase(m),
        job_id: jobId
      }))

      const { data, error } = await supabase
        .from('training_metrics')
        .insert(records)
        .select()

      if (error) throw error
      return { success: true, data: data.map(toCamelCase) }
    } catch (error) {
      console.error('trainingMetricsRepo.bulkLog error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get latest metrics for a job
   */
  async getLatest(jobId) {
    try {
      const { data, error } = await supabase
        .from('training_metrics')
        .select('*')
        .eq('job_id', jobId)
        .order('epoch', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { success: true, data: data ? toCamelCase(data) : null }
    } catch (error) {
      console.error('trainingMetricsRepo.getLatest error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default trainingMetricsRepo

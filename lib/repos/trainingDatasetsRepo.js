/**
 * Training Datasets Repository
 * Manage dataset collections for training
 */

import { supabase } from '@/lib/supabaseClient'
import { toCamelCase, toSnakeCase } from '@/lib/repos'

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
   * Get dataset by ID with image count
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
      const { data, error } = await supabase
        .from('training_datasets')
        .insert(toSnakeCase(datasetData))
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
      const { data, error } = await supabase
        .from('training_datasets')
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
  },

  /**
   * Add images to dataset
   */
  async addImages(datasetId, imageIds) {
    try {
      const records = imageIds.map(imageId => ({
        dataset_id: datasetId,
        image_id: imageId
      }))

      const { data, error } = await supabase
        .from('training_dataset_images')
        .insert(records)
        .select()

      if (error) throw error

      // Update image count
      await this._updateImageCount(datasetId)

      return { success: true, data: { added: data.length } }
    } catch (error) {
      console.error('trainingDatasetsRepo.addImages error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Remove images from dataset
   */
  async removeImages(datasetId, imageIds) {
    try {
      const { error } = await supabase
        .from('training_dataset_images')
        .delete()
        .eq('dataset_id', datasetId)
        .in('image_id', imageIds)

      if (error) throw error

      // Update image count
      await this._updateImageCount(datasetId)

      return { success: true }
    } catch (error) {
      console.error('trainingDatasetsRepo.removeImages error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get images in dataset
   */
  async getImages(datasetId, { page = 1, limit = 20 } = {}) {
    try {
      const from = (page - 1) * limit

      const { data, error, count } = await supabase
        .from('training_dataset_images')
        .select('image_id, dataset_images(*)', { count: 'exact' })
        .eq('dataset_id', datasetId)
        .range(from, from + limit - 1)

      if (error) throw error

      const images = data.map(r => toCamelCase(r.dataset_images))
      return {
        success: true,
        data: images,
        meta: { total: count, page, limit }
      }
    } catch (error) {
      console.error('trainingDatasetsRepo.getImages error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Update total_images count
   */
  async _updateImageCount(datasetId) {
    const { count } = await supabase
      .from('training_dataset_images')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)

    await supabase
      .from('training_datasets')
      .update({ total_images: count || 0 })
      .eq('id', datasetId)
  }
}

export default trainingDatasetsRepo

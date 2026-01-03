# Phase 8: Repository Layer for Training Pipeline

## Objective
Create repository layer untuk semua training pipeline tables.

---

## Context

Database tables sudah ada (dari schema). Perlu buat repository functions untuk:
- `ai_models` — Model registry
- `dataset_images` — Training images
- `training_datasets` — Dataset collections
- `training_jobs` — Training job management
- `training_metrics` — Per-epoch metrics
- `sample_images` — Reference images

---

## Task 1: AI Models Repository

### 1.1 `lib/repos/aiModelsRepo.js`

```javascript
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
```

---

## Task 2: Training Jobs Repository

### 2.1 `lib/repos/trainingJobsRepo.js`

```javascript
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
```

---

## Task 3: Training Datasets Repository

### 3.1 `lib/repos/trainingDatasetsRepo.js`

```javascript
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
```

---

## Task 4: Dataset Images Repository

### 4.1 `lib/repos/datasetImagesRepo.js`

```javascript
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
  }
}

export default datasetImagesRepo
```

---

## Task 5: Training Metrics Repository

### 5.1 `lib/repos/trainingMetricsRepo.js`

```javascript
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
  }
}

export default trainingMetricsRepo
```

---

## Task 6: Sample Images Repository

### 6.1 `lib/repos/sampleImagesRepo.js`

```javascript
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
  async list({ category, boardId } = {}) {
    try {
      let query = supabase
        .from('sample_images')
        .select('*')

      if (category) query = query.eq('category', category)
      if (boardId) query = query.eq('board_id', boardId)

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error
      return { success: true, data: data.map(toCamelCase) }
    } catch (error) {
      console.error('sampleImagesRepo.list error:', error)
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
```

---

## Verification Checklist

- [ ] `lib/repos/aiModelsRepo.js` created
- [ ] `lib/repos/trainingJobsRepo.js` created
- [ ] `lib/repos/trainingDatasetsRepo.js` created
- [ ] `lib/repos/datasetImagesRepo.js` created
- [ ] `lib/repos/trainingMetricsRepo.js` created
- [ ] `lib/repos/sampleImagesRepo.js` created
- [ ] All repos exported from `lib/repos/index.js`
- [ ] Basic CRUD operations tested

/**
 * Dataset Queue Repository
 * Handles training queue from overrides
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Add item to dataset queue
 * @param {Object} params - { override_id, training_action, priority }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function add({ override_id, training_action, priority = 0 }) {
  try {
    const { data, error } = await supabase
      .from('dataset_queue')
      .insert({ override_id, training_action, priority })
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.add')
  }
}

/**
 * Get pending items from queue
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getPending(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('dataset_queue')
      .select('*, overrides(*)')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.getPending')
  }
}

/**
 * Update queue item status
 * @param {string} id - Queue item ID
 * @param {Object} params - { status, error_message }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function updateStatus(id, { status, error_message = null }) {
  try {
    const update = { status, error_message }
    if (status === 'processed') {
      update.processed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('dataset_queue')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.updateStatus')
  }
}

/**
 * Get queue statistics
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getStats() {
  try {
    const { data, error } = await supabase
      .from('dataset_queue')
      .select('status')

    if (error) throw error

    const stats = { pending: 0, processing: 0, processed: 0, failed: 0, skipped: 0 }
    data.forEach(item => {
      if (stats[item.status] !== undefined) stats[item.status]++
    })

    return { data: stats }
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.getStats')
  }
}

/**
 * Get queue item by ID
 * @param {string} id - Queue item ID
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('dataset_queue')
      .select('*, overrides(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.getById')
  }
}

/**
 * Auto-queue override for training based on override type
 * @param {Object} override - Override data with override_type
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function autoQueueFromOverride(override) {
  try {
    const actionMap = {
      'false_positive_no_defect': 'add_negative',
      'false_positive_acceptable': 'add_negative',
      'misclassification': 'correct_label',
      'false_negative': 'add_positive',
      'other': null
    }

    const overrideType = override.overrideType || override.override_type
    const action = actionMap[overrideType]

    // Skip 'other' type - requires manual review
    if (!action) {
      return { data: null, skipped: true }
    }

    // False negatives get higher priority as they indicate missed defects
    const priority = overrideType === 'false_negative' ? 10 : 0

    return add({
      override_id: override.id,
      training_action: action,
      priority
    })
  } catch (error) {
    return handleError(error, 'datasetQueueRepo.autoQueueFromOverride')
  }
}

export default {
  add,
  getPending,
  updateStatus,
  getStats,
  getById,
  autoQueueFromOverride
}

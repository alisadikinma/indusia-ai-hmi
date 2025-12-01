/**
 * Models Repository
 * Handles AI model management for deployment and sync
 */

import { supabase } from '@/lib/supabaseClient'

/**
 * List all models with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Filter by status
 * @returns {Promise<Array>}
 */
export async function listModels(filters = {}) {
  let query = supabase
    .from('ai_models')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[modelsRepo.listModels]', error)
    return []
  }

  return data || []
}

/**
 * Get the currently active model
 * @returns {Promise<Object|null>}
 */
export async function getActiveModel() {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[modelsRepo.getActiveModel]', error)
    }
    return null
  }

  return data
}

/**
 * Get model by ID
 * @param {string} id - Model ID
 * @returns {Promise<Object|null>}
 */
export async function getModelById(id) {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[modelsRepo.getModelById]', error)
    return null
  }

  return data
}

/**
 * Deploy a model (set as active)
 * @param {string} id - Model ID to deploy
 * @param {string} userId - User performing the deployment
 * @returns {Promise<Object>}
 */
export async function deployModel(id, userId) {
  // First, deactivate all other models
  const { error: deactivateError } = await supabase
    .from('ai_models')
    .update({ is_active: false })
    .neq('id', id)

  if (deactivateError) {
    console.error('[modelsRepo.deployModel] Deactivate error:', deactivateError)
    // Continue anyway - not critical
  }

  // Activate the selected model
  const { data, error } = await supabase
    .from('ai_models')
    .update({
      is_active: true,
      status: 'deployed',
      deployed_at: new Date().toISOString(),
      deployed_by: userId
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[modelsRepo.deployModel]', error)
    throw error
  }

  return data
}

/**
 * Rollback to a previous model
 * @param {string} previousModelId - Previous model ID
 * @param {string} userId - User performing the rollback
 * @returns {Promise<Object>}
 */
export async function rollbackModel(previousModelId, userId) {
  return deployModel(previousModelId, userId)
}

/**
 * Get deployment history
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>}
 */
export async function getDeploymentHistory(limit = 10) {
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, name, version, deployed_at, deployed_by, map50, status, is_active')
    .not('deployed_at', 'is', null)
    .order('deployed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[modelsRepo.getDeploymentHistory]', error)
    return []
  }

  return data || []
}

/**
 * Get signed download URL for model file
 * @param {string} storagePath - Storage path of the model file
 * @param {number} expiresIn - URL expiry in seconds (default 1 hour)
 * @returns {Promise<string|null>}
 */
export async function getModelDownloadUrl(storagePath, expiresIn = 3600) {
  if (!storagePath) {
    return null
  }

  const { data, error } = await supabase.storage
    .from('model-weights')
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('[modelsRepo.getModelDownloadUrl]', error)
    return null
  }

  return data?.signedUrl || null
}

/**
 * Update model status
 * @param {string} id - Model ID
 * @param {string} status - New status
 * @returns {Promise<Object|null>}
 */
export async function updateModelStatus(id, status) {
  const { data, error } = await supabase
    .from('ai_models')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[modelsRepo.updateModelStatus]', error)
    return null
  }

  return data
}

/**
 * Deprecate a model
 * @param {string} id - Model ID
 * @returns {Promise<Object|null>}
 */
export async function deprecateModel(id) {
  return updateModelStatus(id, 'deprecated')
}

export default {
  listModels,
  getActiveModel,
  getModelById,
  deployModel,
  rollbackModel,
  getDeploymentHistory,
  getModelDownloadUrl,
  updateModelStatus,
  deprecateModel
}

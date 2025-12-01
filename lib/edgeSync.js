/**
 * Edge Device Sync Helper
 * Handles synchronization of models to edge inference devices
 */

const EDGE_API_URL = process.env.EDGE_DEVICE_URL || process.env.NEXT_PUBLIC_EDGE_DEVICE_URL

/**
 * Check if edge sync is configured
 * @returns {boolean}
 */
export function isEdgeSyncConfigured() {
  return Boolean(EDGE_API_URL)
}

/**
 * Sync model to edge device
 * @param {string} modelUrl - Download URL for the model
 * @param {string} modelId - Model ID
 * @param {Object} metadata - Additional model metadata
 * @returns {Promise<Object>}
 */
export async function syncModelToEdge(modelUrl, modelId, metadata = {}) {
  if (!EDGE_API_URL) {
    console.warn('[edgeSync] Edge device URL not configured')
    return {
      success: false,
      reason: 'not_configured',
      message: 'Edge device URL not configured'
    }
  }

  try {
    const res = await fetch(`${EDGE_API_URL}/models/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_url: modelUrl,
        model_id: modelId,
        model_name: metadata.name,
        model_version: metadata.version,
        timestamp: new Date().toISOString()
      })
    })

    if (!res.ok) {
      throw new Error(`Edge API returned ${res.status}`)
    }

    const result = await res.json()
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('[edgeSync] Sync failed:', error)
    return {
      success: false,
      error: error.message,
      message: 'Failed to sync model to edge device'
    }
  }
}

/**
 * Check edge device health/status
 * @returns {Promise<Object>}
 */
export async function checkEdgeHealth() {
  if (!EDGE_API_URL) {
    return {
      success: false,
      status: 'not_configured'
    }
  }

  try {
    const res = await fetch(`${EDGE_API_URL}/health`, {
      method: 'GET',
      timeout: 5000
    })

    if (!res.ok) {
      throw new Error(`Edge API returned ${res.status}`)
    }

    const result = await res.json()
    return {
      success: true,
      status: 'online',
      data: result
    }
  } catch (error) {
    console.error('[edgeSync] Health check failed:', error)
    return {
      success: false,
      status: 'offline',
      error: error.message
    }
  }
}

/**
 * Get current model info from edge device
 * @returns {Promise<Object>}
 */
export async function getEdgeModelInfo() {
  if (!EDGE_API_URL) {
    return {
      success: false,
      reason: 'not_configured'
    }
  }

  try {
    const res = await fetch(`${EDGE_API_URL}/models/current`, {
      method: 'GET'
    })

    if (!res.ok) {
      throw new Error(`Edge API returned ${res.status}`)
    }

    const result = await res.json()
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('[edgeSync] Get model info failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Rollback edge device to previous model
 * @returns {Promise<Object>}
 */
export async function rollbackEdgeModel() {
  if (!EDGE_API_URL) {
    return {
      success: false,
      reason: 'not_configured'
    }
  }

  try {
    const res = await fetch(`${EDGE_API_URL}/models/rollback`, {
      method: 'POST'
    })

    if (!res.ok) {
      throw new Error(`Edge API returned ${res.status}`)
    }

    const result = await res.json()
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('[edgeSync] Rollback failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export default {
  isEdgeSyncConfigured,
  syncModelToEdge,
  checkEdgeHealth,
  getEdgeModelInfo,
  rollbackEdgeModel
}

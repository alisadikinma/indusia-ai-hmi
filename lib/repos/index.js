/**
 * Repository Layer - Base Helpers
 * Common utilities for all repository modules
 */

/**
 * Handle and log errors from Supabase operations
 * @param {Error} error - The error object
 * @param {string} context - Context/function name for logging
 * @returns {{ error: string }}
 */
export function handleError(error, context) {
  console.error(`[${context}]`, error)
  return { error: error.message || 'Unknown error' }
}

/**
 * Format response for consistent API returns
 * @param {any} data - The data to return
 * @param {string|null} error - Error message if any
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
export function formatResponse(data, error = null) {
  if (error) return { success: false, error }
  return { success: true, data }
}

/**
 * Convert snake_case keys to camelCase
 * @param {Object} obj - Object with snake_case keys
 * @returns {Object} - Object with camelCase keys
 */
export function toCamelCase(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    acc[camelKey] = toCamelCase(obj[key])
    return acc
  }, {})
}

/**
 * Convert camelCase keys to snake_case
 * @param {Object} obj - Object with camelCase keys
 * @returns {Object} - Object with snake_case keys
 */
export function toSnakeCase(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)

  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    acc[snakeKey] = toSnakeCase(obj[key])
    return acc
  }, {})
}

// Training Pipeline Repositories
export { aiModelsRepo } from './aiModelsRepo'
export { trainingJobsRepo } from './trainingJobsRepo'
export { trainingDatasetsRepo } from './trainingDatasetsRepo'
export { datasetImagesRepo } from './datasetImagesRepo'
export { trainingMetricsRepo } from './trainingMetricsRepo'
export { sampleImagesRepo } from './sampleImagesRepo'

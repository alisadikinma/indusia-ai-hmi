/**
 * Custom API Error class with status code and error code support
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.timestamp = new Date().toISOString()
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    }
  }
}

/**
 * Common API error types
 */
export const APIErrors = {
  NotFound: (resource = 'Resource') =>
    new APIError(`${resource} not found`, 404, 'NOT_FOUND'),

  Unauthorized: () =>
    new APIError('Authentication required', 401, 'UNAUTHORIZED'),

  Forbidden: () =>
    new APIError('Permission denied', 403, 'FORBIDDEN'),

  BadRequest: (message = 'Invalid request') =>
    new APIError(message, 400, 'BAD_REQUEST'),

  Conflict: (message = 'Resource conflict') =>
    new APIError(message, 409, 'CONFLICT'),

  ValidationError: (details) =>
    new APIError('Validation failed', 400, 'VALIDATION_ERROR', details),

  InternalError: (message = 'An unexpected error occurred') =>
    new APIError(message, 500, 'INTERNAL_ERROR')
}

/**
 * Supabase error code mappings
 */
const SUPABASE_ERROR_MAPPINGS = {
  'PGRST116': { message: 'Record not found', status: 404, code: 'NOT_FOUND' },
  '23505': { message: 'Duplicate record exists', status: 409, code: 'DUPLICATE' },
  '23503': { message: 'Referenced record not found', status: 400, code: 'FOREIGN_KEY_VIOLATION' },
  '42501': { message: 'Permission denied', status: 403, code: 'FORBIDDEN' },
  '23514': { message: 'Check constraint violation', status: 400, code: 'CONSTRAINT_VIOLATION' },
  '22P02': { message: 'Invalid input syntax', status: 400, code: 'INVALID_INPUT' },
  '42P01': { message: 'Table not found', status: 500, code: 'TABLE_NOT_FOUND' },
  'PGRST301': { message: 'JWT expired', status: 401, code: 'TOKEN_EXPIRED' },
  'PGRST302': { message: 'JWT invalid', status: 401, code: 'INVALID_TOKEN' }
}

/**
 * Handle and transform errors into consistent API response format
 * @param {Error} error - The error to handle
 * @returns {Object} Formatted error response
 */
export function handleAPIError(error) {
  console.error('[API Error]', error)

  // Already an APIError
  if (error instanceof APIError) {
    return error.toJSON()
  }

  // Supabase/PostgreSQL errors
  if (error?.code) {
    const mapped = SUPABASE_ERROR_MAPPINGS[error.code]
    if (mapped) {
      return {
        success: false,
        error: error.message || mapped.message,
        code: mapped.code,
        statusCode: mapped.status,
        details: error.details || null
      }
    }
  }

  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      success: false,
      error: 'Network error - please check your connection',
      code: 'NETWORK_ERROR',
      statusCode: 503
    }
  }

  // Timeout errors
  if (error.name === 'AbortError') {
    return {
      success: false,
      error: 'Request timed out',
      code: 'TIMEOUT',
      statusCode: 504
    }
  }

  // Generic error
  return {
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? error.message
      : 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500
  }
}

/**
 * Higher-order function wrapper for API route handlers with error handling
 * @param {Function} handler - The API route handler function
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      const errorResponse = handleAPIError(error)

      // Log to error reporting service in production
      if (process.env.NODE_ENV === 'production') {
        logErrorAsync(error, request)
      }

      return Response.json(
        {
          success: false,
          error: errorResponse.error,
          code: errorResponse.code
        },
        { status: errorResponse.statusCode }
      )
    }
  }
}

/**
 * Async error logging (fire and forget)
 */
async function logErrorAsync(error, request) {
  try {
    const url = new URL(request.url)
    console.error('[API Error Log]', {
      path: url.pathname,
      method: request.method,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    // Could also send to external service like Sentry here
  } catch {
    // Silent fail
  }
}

/**
 * Create success response with consistent format
 * @param {any} data - Response data
 * @param {Object} meta - Optional metadata (pagination, etc.)
 */
export function successResponse(data, meta = null) {
  const response = { success: true, data }
  if (meta) response.meta = meta
  return response
}

/**
 * Create error response with consistent format
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 */
export function errorResponse(message, statusCode = 400, code = 'ERROR') {
  return Response.json(
    { success: false, error: message, code },
    { status: statusCode }
  )
}

/**
 * API Key Authentication for AI Backend
 *
 * Validates X-API-Key header for AI Backend API endpoints.
 * All /api/ai/* routes should use this middleware.
 *
 * DEV MODE: Auth bypassed when NODE_ENV === 'development'
 *
 * Usage:
 *   export const POST = withApiKeyAuth(handlePOST)
 *   export const GET = withApiKeyOrUserAuth(handleGET)
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from './apiAuth'
import { unauthorizedResponse } from './rbac'

// Bypass auth in development for Swagger testing
const DEV_MODE = process.env.NODE_ENV === 'development'

/**
 * Validate API key from X-API-Key header
 * @param {Request} request - The incoming request
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateApiKey(request) {
  // Bypass in development mode
  if (DEV_MODE) {
    return { valid: true, bypassed: true }
  }

  const apiKey = request.headers.get('x-api-key')
  const validKey = process.env.AI_BACKEND_API_KEY

  if (!validKey) {
    console.error('[ApiKeyAuth] AI_BACKEND_API_KEY not configured in environment')
    return { valid: false, error: 'Server configuration error' }
  }

  if (!apiKey) {
    return { valid: false, error: 'API key required' }
  }

  if (apiKey !== validKey) {
    console.warn('[ApiKeyAuth] Invalid API key attempt')
    return { valid: false, error: 'Invalid API key' }
  }

  return { valid: true }
}

/**
 * Higher-order function to wrap API handlers with API key authentication
 * Use this for endpoints that should ONLY be accessible by AI Backend
 *
 * @param {Function} handler - The API handler function
 * @returns {Function} Wrapped handler with API key validation
 *
 * @example
 * async function handlePOST(request) {
 *   // request.apiKeyAuth = true
 *   // request.authType = 'api-key'
 *   return NextResponse.json({ success: true })
 * }
 * export const POST = withApiKeyAuth(handlePOST)
 */
export function withApiKeyAuth(handler) {
  return async (request, context) => {
    const validation = validateApiKey(request)

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    }

    // Add metadata to request for handler access
    request.apiKeyAuth = true
    request.authType = validation.bypassed ? 'dev-bypass' : 'api-key'

    return handler(request, context)
  }
}

/**
 * Combined auth: API key OR user session
 * Useful for endpoints accessed by both AI Backend and UI
 *
 * @param {Function} handler - The API handler function
 * @returns {Function} Wrapped handler with combined authentication
 *
 * @example
 * // Endpoint accessible by both AI Backend (via API key) and UI (via session)
 * async function handleGET(request) {
 *   if (request.authType === 'api-key') {
 *     // Called by AI Backend
 *   } else {
 *     // Called by UI, request.user is available
 *   }
 * }
 * export const GET = withApiKeyOrUserAuth(handleGET)
 */
export function withApiKeyOrUserAuth(handler) {
  return async (request, context) => {
    // Bypass in development mode
    if (DEV_MODE) {
      request.apiKeyAuth = true
      request.authType = 'dev-bypass'
      return handler(request, context)
    }

    // Try API key first
    const apiKeyValidation = validateApiKey(request)
    if (apiKeyValidation.valid) {
      request.apiKeyAuth = true
      request.authType = 'api-key'
      return handler(request, context)
    }

    // Fall back to user auth
    const user = await getAuthUser(request)
    if (user) {
      request.user = user
      request.authType = 'user'
      return handler(request, context)
    }

    return unauthorizedResponse('Authentication required')
  }
}

/**
 * Optional API key check - doesn't reject requests without valid key
 * Useful for endpoints that work differently based on auth type
 *
 * @param {Function} handler - The API handler function
 * @returns {Function} Wrapped handler
 */
export function withOptionalApiKey(handler) {
  return async (request, context) => {
    const apiKeyValidation = validateApiKey(request)

    if (apiKeyValidation.valid) {
      request.apiKeyAuth = true
      request.authType = apiKeyValidation.bypassed ? 'dev-bypass' : 'api-key'
    } else {
      request.apiKeyAuth = false
      request.authType = null
    }

    return handler(request, context)
  }
}

/**
 * Check if request is authenticated via API key
 * @param {Request} request - The request object
 * @returns {boolean} True if authenticated via API key
 */
export function isApiKeyAuth(request) {
  return request.apiKeyAuth === true && ['api-key', 'dev-bypass'].includes(request.authType)
}

/**
 * CSRF Protection Utility
 * Uses Double-Submit Cookie pattern (stateless)
 * 
 * How it works:
 * 1. Server generates random token, sets as httpOnly cookie
 * 2. Client must send same token in X-CSRF-Token header
 * 3. Server compares cookie value with header value
 */

import { NextResponse } from 'next/server'

// Token configuration
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH = 32

/**
 * Generate cryptographically secure random token
 */
export function generateCSRFToken() {
  const array = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    if (key && value) acc[key] = value
    return acc
  }, {})
  return cookies[CSRF_COOKIE_NAME]
}

/**
 * Get CSRF token from header
 */
export function getCSRFTokenFromHeader(request) {
  return request.headers.get(CSRF_HEADER_NAME)
}

/**
 * Validate CSRF token (double-submit pattern)
 */
export function validateCSRFToken(request) {
  const cookieToken = getCSRFTokenFromCookie(request)
  const headerToken = getCSRFTokenFromHeader(request)

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i)
  }

  return result === 0
}

/**
 * Create response with CSRF cookie
 */
export function setCSRFCookie(response, token) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JS to send in header
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })

  return response
}

/**
 * CSRF validation error response
 */
export function csrfErrorResponse() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_ERROR'
    },
    { status: 403 }
  )
}

/**
 * Higher-order function to wrap handlers with CSRF protection
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE)
 */
export function withCSRF(handler) {
  return async (request, context) => {
    const method = request.method.toUpperCase()
    
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return handler(request, context)
    }

    // Skip CSRF in development if header not present (for curl testing)
    const isDev = process.env.NODE_ENV === 'development'
    const hasCSRFHeader = request.headers.has(CSRF_HEADER_NAME)
    
    if (isDev && !hasCSRFHeader) {
      // In dev, allow requests without CSRF for easier testing
      // Log warning so developers know to add it
      console.warn(`[CSRF] Warning: Request to ${request.url} without CSRF token (dev mode)`)
      return handler(request, context)
    }

    // Validate CSRF token
    if (!validateCSRFToken(request)) {
      return csrfErrorResponse()
    }

    return handler(request, context)
  }
}

/**
 * Combined auth + CSRF protection
 * Usage: export const POST = withAuthAndCSRF('permission')(handler)
 */
export function withAuthAndCSRF(permission = null) {
  return (handler) => {
    // Import here to avoid circular dependency
    const { withAuth } = require('@/lib/auth/apiAuth')
    
    // First apply CSRF, then auth
    const csrfProtected = withCSRF(handler)
    return withAuth(permission)(csrfProtected)
  }
}

/**
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis or a dedicated service
 */

// Store: { key: { count: number, resetTime: number } }
const rateLimitStore = new Map()

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if request is rate limited
 * @param {string} key - Unique identifier (IP, user ID, etc.)
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  // No existing record or window expired
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: windowMs
    }
  }

  // Within window
  record.count++

  if (record.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetTime - now
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetIn: record.resetTime - now
  }
}

/**
 * Get client IP from request
 */
export function getClientIP(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         'unknown'
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Strict limit for login (prevent brute force)
  login: { maxRequests: 5, windowMs: 60 * 1000 },  // 5 per minute
  
  // Moderate limit for password changes
  passwordChange: { maxRequests: 3, windowMs: 60 * 1000 },  // 3 per minute
  
  // Standard limit for API calls
  standard: { maxRequests: 100, windowMs: 60 * 1000 },  // 100 per minute
  
  // Strict limit for sensitive operations
  sensitive: { maxRequests: 10, windowMs: 60 * 1000 }  // 10 per minute
}

/**
 * Create rate limit response
 */
export function rateLimitResponse(resetIn) {
  return {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
    retryAfter: Math.ceil(resetIn / 1000)
  }
}

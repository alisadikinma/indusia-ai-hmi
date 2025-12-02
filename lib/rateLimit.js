/**
 * Rate Limiting Module for INDUSIA AI HMI
 * Simple in-memory rate limiter for API endpoints
 *
 * Note: For production with multiple server instances,
 * consider using Redis-based rate limiting instead
 */

// In-memory storage for request counts
const requestStore = new Map()

// Cleanup interval (remove stale entries every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Start cleanup timer (only in non-Edge runtime)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, data] of requestStore.entries()) {
      if (now - data.windowStart > data.windowMs * 2) {
        requestStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)
}

/**
 * Default rate limit options
 */
const DEFAULT_OPTIONS = {
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // Max requests per window
  message: 'Too many requests, please try again later',
  keyGenerator: (request) => {
    return request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           'unknown'
  }
}

/**
 * Create a rate limiter with specified options
 * @param {Object} options - Rate limit configuration
 * @returns {Function} Rate limit checker function
 */
export function rateLimit(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }

  return async (request) => {
    const key = config.keyGenerator(request)
    const now = Date.now()

    // Get or create entry for this key
    let entry = requestStore.get(key)

    if (!entry || now - entry.windowStart >= config.windowMs) {
      // New window
      entry = {
        count: 1,
        windowStart: now,
        windowMs: config.windowMs
      }
      requestStore.set(key, entry)
      return { allowed: true, remaining: config.max - 1 }
    }

    // Existing window
    entry.count++

    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        message: config.message
      }
    }

    return {
      allowed: true,
      remaining: config.max - entry.count
    }
  }
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 * @param {Object} options - Rate limit options
 * @returns {Function} Wrapper function
 */
export function withRateLimit(options = {}) {
  const limiter = rateLimit(options)

  return (handler) => {
    return async (request, context) => {
      const result = await limiter(request)

      if (!result.allowed) {
        return Response.json(
          {
            success: false,
            error: result.message || 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: result.retryAfter
          },
          {
            status: 429,
            headers: {
              'Retry-After': result.retryAfter.toString(),
              'X-RateLimit-Remaining': '0'
            }
          }
        )
      }

      // Add rate limit headers to response
      const response = await handler(request, context)

      // Clone response to add headers (if it's a Response object)
      if (response instanceof Response) {
        const newResponse = new Response(response.body, response)
        newResponse.headers.set('X-RateLimit-Remaining', result.remaining.toString())
        return newResponse
      }

      return response
    }
  }
}

/**
 * Preset rate limiters for common use cases
 */
export const rateLimiters = {
  // Standard API endpoints
  standard: rateLimit({
    windowMs: 60 * 1000,
    max: 100
  }),

  // Strict rate limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later'
  }),

  // Rate limit for file uploads
  upload: rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 uploads per minute
    message: 'Too many uploads, please wait a moment'
  }),

  // Rate limit for expensive operations (reports, exports)
  expensive: rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Please wait before performing this operation again'
  }),

  // Very strict rate limit for sensitive operations
  sensitive: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Security limit reached, please try again later'
  })
}

/**
 * Apply rate limiting based on endpoint type
 * @param {string} type - Type of rate limit to apply
 * @returns {Function} Wrapper function
 */
export function withRateLimitType(type) {
  const limiterOptions = {
    standard: { windowMs: 60 * 1000, max: 100 },
    auth: { windowMs: 15 * 60 * 1000, max: 10 },
    upload: { windowMs: 60 * 1000, max: 10 },
    expensive: { windowMs: 60 * 1000, max: 5 },
    sensitive: { windowMs: 60 * 60 * 1000, max: 5 }
  }

  const options = limiterOptions[type] || limiterOptions.standard
  return withRateLimit(options)
}

/**
 * Get current rate limit status for a key
 * @param {string} key - The rate limit key (usually IP)
 * @returns {Object|null} Current status or null if no data
 */
export function getRateLimitStatus(key) {
  const entry = requestStore.get(key)
  if (!entry) return null

  const now = Date.now()
  const windowRemaining = Math.max(0, entry.windowStart + entry.windowMs - now)

  return {
    count: entry.count,
    windowStart: entry.windowStart,
    windowRemaining,
    isLimited: entry.count > 100 // Using default max
  }
}

/**
 * Reset rate limit for a specific key (admin function)
 * @param {string} key - The key to reset
 */
export function resetRateLimit(key) {
  requestStore.delete(key)
}

/**
 * Get all current rate limit entries (admin function)
 * @returns {Object} Map of all entries
 */
export function getAllRateLimits() {
  const result = {}
  for (const [key, data] of requestStore.entries()) {
    result[key] = { ...data }
  }
  return result
}

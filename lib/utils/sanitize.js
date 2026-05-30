/**
 * Input Sanitization Utilities for INDUSIA AI HMI
 * Prevents XSS, SQL injection, and prototype pollution attacks
 */

// ============================================
// HTML/XSS Sanitization
// ============================================

/**
 * Sanitize string for safe HTML display (prevent XSS)
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHTML(str) {
  if (!str || typeof str !== 'string') return ''

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#x60;')
}

/**
 * Remove all HTML tags from a string
 * @param {string} str - The string to strip
 * @returns {string} String without HTML tags
 */
export function stripHTML(str) {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize string for use in JavaScript context
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeJS(str) {
  if (!str || typeof str !== 'string') return ''

  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// ============================================
// Object Sanitization
// ============================================

/**
 * Dangerous keys that could cause prototype pollution
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * Sanitize object to prevent prototype pollution
 * @param {any} obj - The object to sanitize
 * @param {number} depth - Current recursion depth (internal)
 * @param {number} maxDepth - Maximum recursion depth (default: 10)
 * @returns {any} Sanitized object
 */
export function sanitizeObject(obj, depth = 0, maxDepth = 10) {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return null
  }

  // Handle primitives
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1, maxDepth))
  }

  // Handle objects
  const clean = {}

  for (const key of Object.keys(obj)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.includes(key)) {
      console.warn(`[Sanitize] Blocked dangerous key: ${key}`)
      continue
    }

    // Skip keys with suspicious patterns
    if (key.startsWith('__') && key.endsWith('__')) {
      console.warn(`[Sanitize] Blocked suspicious key: ${key}`)
      continue
    }

    clean[key] = sanitizeObject(obj[key], depth + 1, maxDepth)
  }

  return clean
}

// ============================================
// ID Validation
// ============================================

/**
 * Valid ID pattern: alphanumeric, dash, underscore
 */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * UUID pattern
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate ID format (prevent injection via IDs)
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid
 */
export function isValidId(id) {
  if (!id || typeof id !== 'string') return false
  if (id.length > 100) return false // Prevent oversized IDs
  return ID_PATTERN.test(id)
}

/**
 * Validate UUID format
 * @param {string} uuid - The UUID to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false
  return UUID_PATTERN.test(uuid)
}

/**
 * Validate and sanitize an ID
 * @param {string} id - The ID to validate
 * @returns {string | null} Sanitized ID or null if invalid
 */
export function sanitizeId(id) {
  if (!isValidId(id)) return null
  return id.trim()
}

// ============================================
// String Sanitization
// ============================================

/**
 * Sanitize a string by trimming and limiting length
 * @param {string} str - The string to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return ''
  return str.trim().slice(0, maxLength)
}

/**
 * Sanitize email address
 * @param {string} email - The email to sanitize
 * @returns {string} Sanitized email (lowercase, trimmed)
 */
export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

/**
 * Sanitize filename (remove path traversal attempts)
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return ''

  return filename
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*]/g, '') // Remove invalid characters
    .replace(/^\./, '') // Remove leading dot (hidden files)
    .trim()
    .slice(0, 255) // Limit length
}

// ============================================
// URL Sanitization
// ============================================

/**
 * Validate and sanitize a URL
 * @param {string} url - The URL to validate
 * @param {string[]} allowedProtocols - Allowed protocols
 * @returns {string | null} Sanitized URL or null if invalid
 */
export function sanitizeURL(url, allowedProtocols = ['http:', 'https:']) {
  if (!url || typeof url !== 'string') return null

  try {
    const parsed = new URL(url)

    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null
    }

    // Block javascript: and data: URLs
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return null
    }

    return parsed.href
  } catch {
    return null
  }
}

// ============================================
// SQL-Related Sanitization
// ============================================

/**
 * Escape special characters for use in LIKE queries
 * Note: Supabase/PostgreSQL handles parameterized queries, but this is useful for LIKE patterns
 * @param {string} str - The string to escape
 * @returns {string} Escaped string
 */
export function escapeLikePattern(str) {
  if (!str || typeof str !== 'string') return ''

  return str
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

// ============================================
// Request Body Sanitization
// ============================================

/**
 * Sanitize an entire request body object
 * @param {Object} body - The request body
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized body
 */
export function sanitizeRequestBody(body, options = {}) {
  const {
    maxStringLength = 10000,
    maxDepth = 10,
    stripHTML: shouldStripHTML = false
  } = options

  if (!body || typeof body !== 'object') {
    return {}
  }

  // First, prevent prototype pollution
  const clean = sanitizeObject(body, 0, maxDepth)

  // Then process string values
  function processValue(value) {
    if (typeof value === 'string') {
      let processed = value.slice(0, maxStringLength)
      if (shouldStripHTML) {
        processed = stripHTML(processed)
      }
      return processed.trim()
    }
    if (Array.isArray(value)) {
      return value.map(processValue)
    }
    if (value && typeof value === 'object') {
      const result = {}
      for (const key of Object.keys(value)) {
        result[key] = processValue(value[key])
      }
      return result
    }
    return value
  }

  return processValue(clean)
}

// ============================================
// Logging Sanitization
// ============================================

/**
 * Sanitize sensitive data for logging
 * @param {Object} data - Data to sanitize for logs
 * @param {string[]} sensitiveFields - Fields to mask
 * @returns {Object} Sanitized data safe for logging
 */
export function sanitizeForLogging(data, sensitiveFields = ['password', 'token', 'secret', 'api_key', 'apiKey']) {
  if (!data || typeof data !== 'object') return data

  const sanitized = { ...data }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  // Also check nested objects
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key], sensitiveFields)
    }
  }

  return sanitized
}

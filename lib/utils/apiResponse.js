/**
 * Standardized API Response helpers for AI Backend API
 *
 * Provides consistent response formatting for all API endpoints.
 * Use these helpers instead of raw NextResponse.json() calls.
 */

import { NextResponse } from 'next/server'

/**
 * Success response with data
 * @param {any} data - Response data
 * @param {object|null} meta - Optional metadata (pagination, etc.)
 * @param {number} status - HTTP status code (default: 200)
 * @returns {NextResponse}
 */
export function successResponse(data, meta = null, status = 200) {
  const response = { success: true, data }
  if (meta) response.meta = meta
  return NextResponse.json(response, { status })
}

/**
 * Created response (201)
 * @param {any} data - Created resource data
 * @returns {NextResponse}
 */
export function createdResponse(data) {
  return successResponse(data, null, 201)
}

/**
 * Error response
 * @param {string} error - Error message
 * @param {string} code - Error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
 * @param {number} status - HTTP status code (default: 500)
 * @param {object|null} details - Optional error details
 * @returns {NextResponse}
 */
export function errorResponse(error, code = 'INTERNAL_ERROR', status = 500, details = null) {
  const response = {
    success: false,
    error,
    code
  }
  if (details) response.details = details
  return NextResponse.json(response, { status })
}

/**
 * Not found response (404)
 * @param {string} resource - Resource name for error message
 * @returns {NextResponse}
 */
export function notFoundResponse(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 'NOT_FOUND', 404)
}

/**
 * Validation error response (400)
 * @param {object|array} errors - Validation errors
 * @returns {NextResponse}
 */
export function validationErrorResponse(errors) {
  return errorResponse('Validation failed', 'VALIDATION_ERROR', 400, { errors })
}

/**
 * Duplicate entry response (409)
 * @param {string} field - Field name that has duplicate
 * @returns {NextResponse}
 */
export function duplicateResponse(field = 'entry') {
  return errorResponse(`Duplicate ${field}`, 'DUPLICATE_ENTRY', 409)
}

/**
 * Forbidden response (403)
 * @param {string} message - Optional custom message
 * @returns {NextResponse}
 */
export function forbiddenResponse(message = 'Access denied') {
  return errorResponse(message, 'FORBIDDEN', 403)
}

/**
 * Unauthorized response (401)
 * @param {string} message - Optional custom message
 * @returns {NextResponse}
 */
export function unauthorizedResponse(message = 'Authentication required') {
  return errorResponse(message, 'AUTH_REQUIRED', 401)
}

/**
 * Bad request response (400)
 * @param {string} message - Error message
 * @returns {NextResponse}
 */
export function badRequestResponse(message = 'Bad request') {
  return errorResponse(message, 'BAD_REQUEST', 400)
}

/**
 * Paginated response
 * @param {array} data - Array of items
 * @param {object} pagination - Pagination info
 * @param {number} pagination.total - Total count
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @returns {NextResponse}
 */
export function paginatedResponse(data, { total, page, limit }) {
  return successResponse(data, {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  })
}

/**
 * No content response (204)
 * @returns {NextResponse}
 */
export function noContentResponse() {
  return new NextResponse(null, { status: 204 })
}

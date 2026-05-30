import { ZodError } from 'zod'

/**
 * Validate data against a Zod schema
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @param {any} data - The data to validate
 * @returns {{ success: boolean, data?: any, errors?: Array<{ field: string, message: string }> }}
 */
export function validate(schema, data) {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
      return { success: false, errors }
    }
    throw error
  }
}

/**
 * Validate data and throw an error if validation fails
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @param {any} data - The data to validate
 * @returns {any} The validated data
 * @throws {ValidationError} If validation fails
 */
export function validateOrThrow(schema, data) {
  const result = validate(schema, data)
  if (!result.success) {
    const error = new Error('Validation failed')
    error.name = 'ValidationError'
    error.statusCode = 400
    error.code = 'VALIDATION_ERROR'
    error.details = result.errors
    throw error
  }
  return result.data
}

/**
 * Safe parse that returns null for invalid data instead of throwing
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @param {any} data - The data to validate
 * @returns {any | null} The validated data or null if invalid
 */
export function safeParse(schema, data) {
  const result = validate(schema, data)
  return result.success ? result.data : null
}

/**
 * Validate query parameters from URL
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @param {URLSearchParams | Record<string, string>} params - Query parameters
 * @returns {{ success: boolean, data?: any, errors?: Array<{ field: string, message: string }> }}
 */
export function validateQueryParams(schema, params) {
  const data = {}

  // Convert URLSearchParams to object
  if (params instanceof URLSearchParams) {
    for (const [key, value] of params.entries()) {
      data[key] = value
    }
  } else {
    Object.assign(data, params)
  }

  return validate(schema, data)
}

/**
 * Higher-order function to create a validated API handler
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate request body against
 * @returns {Function} Middleware function that validates request body
 */
export function withValidation(schema) {
  return async (request) => {
    const body = await request.json()
    return validateOrThrow(schema, body)
  }
}

/**
 * Create a validation response for API errors
 * @param {Array<{ field: string, message: string }>} errors - Validation errors
 * @returns {Response} JSON response with validation errors
 */
export function validationErrorResponse(errors) {
  return Response.json(
    {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors
    },
    { status: 400 }
  )
}

/**
 * Validate request body and return appropriate response
 * @param {import('zod').ZodSchema} schema - The Zod schema
 * @param {Request} request - The request object
 * @returns {Promise<{ valid: boolean, data?: any, response?: Response }>}
 */
export async function validateRequestBody(schema, request) {
  try {
    const body = await request.json()
    const result = validate(schema, body)

    if (!result.success) {
      return {
        valid: false,
        response: validationErrorResponse(result.errors)
      }
    }

    return { valid: true, data: result.data }
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        valid: false,
        response: Response.json(
          {
            success: false,
            error: 'Invalid JSON in request body',
            code: 'INVALID_JSON'
          },
          { status: 400 }
        )
      }
    }
    throw error
  }
}

/**
 * Validate path parameters
 * @param {import('zod').ZodSchema} schema - The Zod schema
 * @param {Record<string, string>} params - Path parameters
 * @returns {{ valid: boolean, data?: any, response?: Response }}
 */
export function validateParams(schema, params) {
  const result = validate(schema, params)

  if (!result.success) {
    return {
      valid: false,
      response: validationErrorResponse(result.errors)
    }
  }

  return { valid: true, data: result.data }
}

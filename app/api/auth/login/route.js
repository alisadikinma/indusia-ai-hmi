import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { loginSchema } from '@/lib/validations/schemas'
import { validate, validationErrorResponse } from '@/lib/validations/validate'
import { sanitizeRequestBody, sanitizeEmail } from '@/lib/utils/sanitize'
import { withRateLimitType } from '@/lib/rateLimit'
import { auditLogin, auditLoginFailed } from '@/lib/audit'

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Response: { success, data: { user } } or { success: false, error }
 *
 * Rate limited: 10 attempts per 15 minutes
 */
async function handleLogin(request) {
  try {
    const body = await request.json()

    // Sanitize input
    const sanitizedBody = sanitizeRequestBody(body)
    if (sanitizedBody.email) {
      sanitizedBody.email = sanitizeEmail(sanitizedBody.email)
    }

    // Validate input with Zod schema
    const validation = validate(loginSchema, sanitizedBody)
    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const { email, password } = validation.data

    // Find user by email
    const result = await usersRepo.getByEmail(email)

    if (result.error || !result.data) {
      // Log failed login attempt
      await auditLoginFailed(email, 'User not found', request)

      // Use generic error message to prevent user enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const user = result.data

    // Check password (plaintext for dev - noted in schema)
    // In production, use bcrypt.compare()
    if (user.password !== password) {
      // Log failed login attempt
      await auditLoginFailed(email, 'Invalid password', request)

      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check user status
    if (user.status !== 'active') {
      // Log failed login attempt
      await auditLoginFailed(email, 'Account inactive', request)

      return NextResponse.json(
        { success: false, error: 'Account is not active. Please contact administrator.' },
        { status: 403 }
      )
    }

    // Remove sensitive data before returning
    const { password: _, ...safeUser } = user

    // Log successful login
    await auditLogin(safeUser, request)

    return NextResponse.json({
      success: true,
      data: {
        user: safeUser
      }
    })
  } catch (error) {
    console.error('[auth/login]', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}

// Apply rate limiting for auth endpoints
export const POST = withRateLimitType('auth')(handleLogin)

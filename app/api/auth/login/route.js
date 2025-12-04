import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { loginSchema } from '@/lib/validations/schemas'
import { validate, validationErrorResponse } from '@/lib/validations/validate'
import { sanitizeRequestBody, sanitizeEmail } from '@/lib/utils/sanitize'
import { withRateLimitType } from '@/lib/rateLimit'
import { auditLogin, auditLoginFailed } from '@/lib/audit'

// Mock users for fallback when Supabase is not configured
const mockUsers = [
  { id: 'u1', name: 'Admin User', email: 'admin@indusia.com', password: 'admin123', role_id: 'superadmin', role: 'superadmin', status: 'active', sections: [] },
  { id: 'u2', name: 'Manager User', email: 'manager@indusia.com', password: 'manager123', role_id: 'manager', role: 'manager', status: 'active', sections: ['sec-smt', 'sec-mi'] },
  { id: 'u3', name: 'Operator User', email: 'operator@indusia.com', password: 'operator123', role_id: 'operator', role: 'operator', status: 'active', sections: ['sec-smt'] },
  { id: 'u4', name: 'Engineer User', email: 'engineer@indusia.com', password: 'engineer123', role_id: 'engineer', role: 'engineer', status: 'active', sections: [] },
]

/**
 * Check if Supabase is properly configured
 */
function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && !url.includes('your-project-id') && !key.includes('your-anon-key')
}

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

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('[auth/login] Supabase not configured, using mock authentication')
      
      // Use mock users
      const mockUser = mockUsers.find(u => u.email === email && u.password === password)
      
      if (!mockUser) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      if (mockUser.status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'Account is not active. Please contact administrator.' },
          { status: 403 }
        )
      }

      // Remove password before returning
      const { password: _, ...safeUser } = mockUser

      return NextResponse.json({
        success: true,
        data: { user: safeUser },
        _mock: true // Indicate this is mock data
      })
    }

    // Try Supabase authentication
    const result = await usersRepo.getByEmail(email)

    if (result.error || !result.data) {
      // Log failed login attempt
      await auditLoginFailed(email, 'User not found', request).catch(() => {})

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
      await auditLoginFailed(email, 'Invalid password', request).catch(() => {})

      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check user status
    if (user.status !== 'active') {
      // Log failed login attempt
      await auditLoginFailed(email, 'Account inactive', request).catch(() => {})

      return NextResponse.json(
        { success: false, error: 'Account is not active. Please contact administrator.' },
        { status: 403 }
      )
    }

    // Remove sensitive data before returning
    const { password: _, ...safeUser } = user

    // Log successful login
    await auditLogin(safeUser, request).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        user: safeUser
      }
    })
  } catch (error) {
    console.error('[auth/login]', error)
    
    // Fallback to mock if Supabase fails
    try {
      const body = await request.clone().json()
      const mockUser = mockUsers.find(u => u.email === body.email && u.password === body.password)
      
      if (mockUser && mockUser.status === 'active') {
        const { password: _, ...safeUser } = mockUser
        return NextResponse.json({
          success: true,
          data: { user: safeUser },
          _mock: true,
          _fallback: true
        })
      }
    } catch (e) {
      // Ignore fallback errors
    }

    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}

// Apply rate limiting for auth endpoints
export const POST = withRateLimitType('auth')(handleLogin)

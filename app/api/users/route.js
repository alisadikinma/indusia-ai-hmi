import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { createUserSchema } from '@/lib/validations/schemas'
import { validate, validationErrorResponse } from '@/lib/validations/validate'
import { withAuth } from '@/lib/auth/apiAuth'
import { withCSRF } from '@/lib/utils/csrf'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { auditUserCreated } from '@/lib/audit'

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeError(error) {
  const errorStr = typeof error === 'string' ? error : error?.message || ''
  
  // Check for common DB error patterns and return generic message
  if (errorStr.includes('violates') || 
      errorStr.includes('constraint') ||
      errorStr.includes('duplicate') ||
      errorStr.includes('relation') ||
      errorStr.includes('column')) {
    return 'Operation failed due to data validation error'
  }
  
  if (errorStr.includes('connection') || errorStr.includes('timeout')) {
    return 'Service temporarily unavailable'
  }
  
  // Return generic message for unknown errors
  return 'Operation failed'
}

/**
 * GET /api/users
 * Query params: role, section, status
 * Required permission: users:read
 */
async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      role: searchParams.get('role'),
      section: searchParams.get('section'),
      status: searchParams.get('status')
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key]
    })

    const result = await usersRepo.list(filters)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data?.length || 0
    })
  } catch (error) {
    console.error('[GET /api/users] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Body: { name, email, role_id, sections, whatsapp, status, password }
 * Required permission: users:create
 */
async function handlePOST(request) {
  try {
    const body = await request.json()

    // Sanitize input
    const sanitizedBody = sanitizeRequestBody(body)

    // Validate input with Zod schema
    const validation = validate(createUserSchema, sanitizedBody)
    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    // Create user
    const result = await usersRepo.create(validation.data)

    if (result.error) {
      console.error('[POST /api/users] Repo error:', result.error)
      
      // Check for duplicate email
      if (result.error.includes('duplicate') || result.error.includes('unique')) {
        return NextResponse.json(
          { success: false, error: 'A user with this email already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: sanitizeError(result.error) },
        { status: 500 }
      )
    }

    // Audit log the user creation
    if (request.user && result.data) {
      try {
        await auditUserCreated(request.user, result.data, request)
      } catch (auditError) {
        // Don't fail user creation if audit fails
        console.error('[POST /api/users] Audit error:', auditError)
      }
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/users] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    )
  }
}

// Apply authentication, authorization + CSRF protection
export const GET = withAuth('users:read')(handleGET)
export const POST = withCSRF(withAuth('users:create')(handlePOST))

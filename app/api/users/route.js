import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { createUserSchema } from '@/lib/validations/schemas'
import { validate, validationErrorResponse } from '@/lib/validations/validate'
import { withAuth, getAuthUser } from '@/lib/auth/apiAuth'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { auditUserCreated } from '@/lib/audit'

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
        { success: false, error: result.error },
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
      { success: false, error: error.message },
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
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Audit log the user creation
    if (request.user && result.data) {
      await auditUserCreated(request.user, result.data, request)
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization
export const GET = withAuth('users:read')(handleGET)
export const POST = withAuth('users:create')(handlePOST)

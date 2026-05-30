import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { withCSRF } from '@/lib/utils/csrf'
import { hasPermission } from '@/lib/auth/rbac'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { z } from 'zod'

// Validation schema for user updates
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role_id: z.string().optional(),
  sections: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'disabled']).optional(),
  whatsapp: z.string().max(20).optional()
}).strict()

/**
 * GET /api/users/:id
 * Users can only access their own data unless they have users:read permission
 */
async function handleGET(request, { params }) {
  try {
    const { id } = params
    const currentUser = request.user

    // IDOR protection
    const isOwnData = currentUser.id === id
    const hasReadPermission = hasPermission(currentUser.role_id, 'users:read')

    if (!isOwnData && !hasReadPermission) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const result = await usersRepo.getById(id)

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[GET /api/users/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/:id
 * Users can update SOME of their own data, admins can update everything
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const currentUser = request.user

    const isOwnData = currentUser.id === id
    const hasUpdatePermission = hasPermission(currentUser.role_id, 'users:update')

    if (!isOwnData && !hasUpdatePermission) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    const validation = updateUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = { ...validation.data }

    // SECURITY: Prevent privilege escalation
    if (updateData.role_id) {
      if (isOwnData) {
        return NextResponse.json(
          { success: false, error: 'Cannot change your own role' },
          { status: 403 }
        )
      }
      if (!hasUpdatePermission) {
        delete updateData.role_id
      }
    }

    if (updateData.status && !isOwnData && !hasUpdatePermission) {
      delete updateData.status
    }

    if (updateData.sections && !isOwnData && !hasUpdatePermission) {
      delete updateData.sections
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No allowed fields to update' },
        { status: 400 }
      )
    }

    const result = await usersRepo.update(id, updateData)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[PATCH /api/users/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/:id (soft delete)
 */
async function handleDELETE(request, { params }) {
  try {
    const { id } = params

    if (request.user.id === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    const result = await usersRepo.remove(id)

    if (result.error) {
      console.error('[DELETE /api/users/[id]] Repo error:', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/users/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}

// Apply authentication + CSRF protection
export const GET = withAuth()(handleGET)
export const PATCH = withCSRF(withAuth()(handlePATCH))
export const DELETE = withCSRF(withAuth('users:delete')(handleDELETE))

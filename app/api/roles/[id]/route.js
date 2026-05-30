import { NextResponse } from 'next/server'
import * as rolesRepo from '@/lib/repos/rolesRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { isValidId } from '@/lib/utils/sanitize'
import { z } from 'zod'

// Validation schema for role updates
const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
}).strict()

/**
 * GET /api/roles/:id
 * Requires roles:read permission
 */
async function handleGET(request, { params }) {
  try {
    const { id } = params

    if (!id || !isValidId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      )
    }

    const result = await rolesRepo.getById(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[GET /api/roles/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/roles/:id
 * Body: { name, description }
 * Requires roles:update permission
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params

    if (!id || !isValidId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    // Validate input
    const validation = updateRoleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    const result = await rolesRepo.update(id, validation.data)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update role' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[PATCH /api/roles/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update role' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/roles/:id
 * Requires roles:delete permission
 */
async function handleDELETE(request, { params }) {
  try {
    const { id } = params

    if (!id || !isValidId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      )
    }

    // Prevent deletion of system roles
    const roleResult = await rolesRepo.getById(id)
    if (roleResult.data?.isSystem) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete system roles' },
        { status: 400 }
      )
    }

    const result = await rolesRepo.remove(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete role' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/roles/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete role' },
      { status: 500 }
    )
  }
}

// Apply authentication
export const GET = withAuth('roles:read')(handleGET)
export const PATCH = withAuth('roles:update')(handlePATCH)
export const DELETE = withAuth('roles:delete')(handleDELETE)

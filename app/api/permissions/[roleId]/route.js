import { NextResponse } from 'next/server'
import * as permissionsRepo from '@/lib/repos/permissionsRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { isValidId } from '@/lib/utils/sanitize'
import { z } from 'zod'

// Validation schema for setting permissions
const setPermissionsSchema = z.object({
  menuIds: z.array(z.string().min(1).max(100)).max(100)
}).strict()

/**
 * GET /api/permissions/:roleId
 * Returns [menuIds] for the role
 * Requires permissions:read permission
 */
async function handleGET(request, { params }) {
  try {
    const { roleId } = params

    if (!roleId || !isValidId(roleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid roleId' },
        { status: 400 }
      )
    }

    const result = await permissionsRepo.getByRole(roleId)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch permissions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error) {
    console.error('[GET /api/permissions/[roleId]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/permissions/:roleId
 * Body: { menuIds: [...] }
 * Replaces all permissions for the role
 * Requires permissions:update permission
 */
async function handlePUT(request, { params }) {
  try {
    const { roleId } = params

    if (!roleId || !isValidId(roleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid roleId' },
        { status: 400 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    // Validate input
    const validation = setPermissionsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await permissionsRepo.setRolePermissions(roleId, validation.data.menuIds)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update permissions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { roleId, menuIds: validation.data.menuIds }
    })
  } catch (error) {
    console.error('[PUT /api/permissions/[roleId]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update permissions' },
      { status: 500 }
    )
  }
}

// Apply authentication
export const GET = withAuth('permissions:read')(handleGET)
export const PUT = withAuth('permissions:update')(handlePUT)

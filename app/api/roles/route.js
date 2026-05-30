import { NextResponse } from 'next/server'
import * as rolesRepo from '@/lib/repos/rolesRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { z } from 'zod'

// Validation schema for creating roles
const createRoleSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Role ID must be lowercase letters, numbers, and dashes only'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isSystem: z.boolean().optional().default(false)
}).strict()

/**
 * GET /api/roles
 * Requires roles:read permission
 */
async function handleGET(request) {
  try {
    const result = await rolesRepo.list()

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch roles' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data?.length || 0
    })
  } catch (error) {
    console.error('[GET /api/roles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/roles
 * Body: { id, name, description, isSystem }
 * Requires roles:create permission
 */
async function handlePOST(request) {
  try {
    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    // Validate input
    const validation = createRoleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await rolesRepo.create(validation.data)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to create role' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/roles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization
export const GET = withAuth('roles:read')(handleGET)
export const POST = withAuth('roles:create')(handlePOST)

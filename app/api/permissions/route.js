import { NextResponse } from 'next/server'
import * as permissionsRepo from '@/lib/repos/permissionsRepo'
import { withAuth } from '@/lib/auth/apiAuth'

/**
 * GET /api/permissions
 * Returns full permission matrix { roleId: [menuIds] }
 * Requires permissions:read permission
 */
async function handleGET(request) {
  try {
    const result = await permissionsRepo.getAllPermissions()

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
    console.error('[GET /api/permissions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}

// Apply authentication - requires permissions:read
export const GET = withAuth('permissions:read')(handleGET)

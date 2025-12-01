import { NextResponse } from 'next/server'
import * as permissionsRepo from '@/lib/repos/permissionsRepo'

/**
 * GET /api/permissions/:roleId
 * Returns [menuIds] for the role
 */
export async function GET(request, { params }) {
  try {
    const { roleId } = params
    const result = await permissionsRepo.getByRole(roleId)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/permissions/:roleId
 * Body: { menuIds: [...] }
 * Replaces all permissions for the role
 */
export async function PUT(request, { params }) {
  try {
    const { roleId } = params
    const body = await request.json()

    if (!body.menuIds || !Array.isArray(body.menuIds)) {
      return NextResponse.json(
        { success: false, error: 'menuIds array is required' },
        { status: 400 }
      )
    }

    const result = await permissionsRepo.setRolePermissions(roleId, body.menuIds)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { roleId, menuIds: body.menuIds }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

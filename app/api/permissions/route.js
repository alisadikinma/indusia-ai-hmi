import { NextResponse } from 'next/server'
import * as permissionsRepo from '@/lib/repos/permissionsRepo'

/**
 * GET /api/permissions
 * Returns full permission matrix { roleId: [menuIds] }
 */
export async function GET() {
  try {
    const result = await permissionsRepo.getAllPermissions()

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

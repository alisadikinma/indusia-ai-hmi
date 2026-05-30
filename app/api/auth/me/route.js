import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { getAuthUser } from '@/lib/auth/apiAuth'
import { normalizeRole } from '@/lib/utils/roleUtils'

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's data
 * SECURITY: Uses session/header auth, NOT query params
 */
export async function GET(request) {
  try {
    // Get authenticated user from session/header
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch full user data (session might have limited fields)
    const result = await usersRepo.getById(user.id)

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }

    const userData = result.data

    // Check user is still active
    if (userData.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Account is not active' },
        { status: 403 }
      )
    }

    // Remove sensitive data
    const { password: _, ...safeUser } = userData

    // Add normalized role
    safeUser.role = normalizeRole(safeUser.role_id)

    return NextResponse.json({
      success: true,
      data: safeUser
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'

/**
 * GET /api/auth/me
 * Query params: userId (for dev session strategy)
 * Response: { success, data: user } or 401
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // For dev, we use userId from query param (stored in localStorage)
    // In production, extract from JWT or session cookie
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const result = await usersRepo.getById(userId)

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }

    const user = result.data

    // Check user is still active
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Account is not active' },
        { status: 403 }
      )
    }

    // Remove sensitive data
    const { password: _, ...safeUser } = user

    return NextResponse.json({
      success: true,
      data: safeUser
    })
  } catch (error) {
    console.error('[auth/me]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

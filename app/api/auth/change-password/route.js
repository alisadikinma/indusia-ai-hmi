import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'

/**
 * POST /api/auth/change-password
 * Body: { userId, currentPassword, newPassword }
 * Response: { success: true } or error
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword } = body

    // Validate required fields
    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Get user
    const result = await usersRepo.getById(userId)

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const user = result.data

    // Verify current password (plaintext for dev)
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Update password
    const updateResult = await usersRepo.update(userId, { password: newPassword })

    if (updateResult.error) {
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('[auth/change-password]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

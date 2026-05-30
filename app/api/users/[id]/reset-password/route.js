import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { withCSRF } from '@/lib/utils/csrf'
import { hasPermission } from '@/lib/auth/rbac'
import crypto from 'crypto'

/**
 * POST /api/users/:id/reset-password
 * Superadmin resets another user's password to a random temporary password.
 * Returns the temp password so the admin can share it with the user.
 */
async function handlePOST(request, { params }) {
  try {
    const { id } = params
    const currentUser = request.user

    // Only users with users:update permission can reset passwords
    if (!hasPermission(currentUser.role_id || currentUser.role, 'users:update')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Prevent resetting own password via this endpoint (use change-password instead)
    if (currentUser.id === id) {
      return NextResponse.json(
        { success: false, error: 'Use change-password endpoint for your own password' },
        { status: 400 }
      )
    }

    // Verify target user exists
    const userResult = await usersRepo.getById(id)
    if (userResult.error || !userResult.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate random temporary password (12 chars, mixed case + numbers)
    const tempPassword = generateTempPassword()

    // Update password in database (repo handles hashing)
    const updateResult = await usersRepo.updatePassword(id, tempPassword)

    if (updateResult.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        tempPassword,
        userId: id,
        userName: userResult.data.name || userResult.data.email
      }
    })
  } catch (error) {
    console.error('[reset-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

/**
 * Generate a secure temporary password
 * Format: 3 uppercase + 3 lowercase + 3 digits + 3 mixed = 12 chars
 */
function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // excluded I, O to avoid confusion
  const lower = 'abcdefghjkmnpqrstuvwxyz'   // excluded i, l, o
  const digits = '23456789'                  // excluded 0, 1

  let password = ''
  password += pick(upper, 3)
  password += pick(lower, 3)
  password += pick(digits, 3)
  password += pick(upper + lower + digits, 3)

  // Shuffle
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('')
}

function pick(chars, count) {
  let result = ''
  for (let i = 0; i < count; i++) {
    result += chars[crypto.randomInt(chars.length)]
  }
  return result
}

export const POST = withCSRF(withAuth()(handlePOST))

import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { withCSRF } from '@/lib/utils/csrf'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { checkRateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from '@/lib/utils/rateLimit'
import { findMockUserById } from '@/data/mockUsers'
import { z } from 'zod'

// Validation schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
}).strict()

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * SECURITY: Uses authenticated user from session, NOT from request body
 */
async function handlePOST(request) {
  const isDev = process.env.NODE_ENV === 'development'

  try {
    // Rate limiting for password changes
    const clientIP = getClientIP(request)
    const rateCheck = checkRateLimit(
      `password:${request.user.id}:${clientIP}`,
      RATE_LIMITS.passwordChange.maxRequests,
      RATE_LIMITS.passwordChange.windowMs
    )

    if (!rateCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse(rateCheck.resetIn),
        { status: 429 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    // Validate input
    const validation = changePasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // New password must differ from current password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // SECURITY: Get userId from authenticated session, NOT from request body
    const userId = request.user.id

    // Get user with password
    const result = await usersRepo.getById(userId, { includePassword: true })

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const user = result.data

    // Verify current password
    let isValid = false

    if (user.password && user.password.startsWith('$2')) {
      // Bcrypt hash
      try {
        const bcrypt = require('bcrypt')
        isValid = await bcrypt.compare(currentPassword, user.password)
      } catch (e) {
        console.error('[change-password] bcrypt error:', e)
      }

      // DEV FALLBACK: If bcrypt hash doesn't match (e.g. stale hash from seed data),
      // also check against mock user's plaintext password
      if (!isValid && isDev) {
        const mockUser = findMockUserById(userId)
        if (mockUser && mockUser.password === currentPassword) {
          isValid = true
          console.warn('[change-password] DEV: Verified via mock user fallback (DB hash out of sync)')
        }
      }
    } else if (isDev) {
      // DEVELOPMENT ONLY: Plaintext comparison
      isValid = user.password === currentPassword
    }
    // In production, plaintext passwords are NOT accepted

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash new password
    let hashedPassword = newPassword
    try {
      const bcrypt = require('bcrypt')
      hashedPassword = await bcrypt.hash(newPassword, 12)
    } catch (e) {
      if (!isDev) {
        // In production, we MUST hash passwords
        console.error('[change-password] bcrypt not available in production!')
        return NextResponse.json(
          { success: false, error: 'Password change failed' },
          { status: 500 }
        )
      }
      // Dev mode: allow plaintext (with warning)
      console.warn('[change-password] WARNING: Storing plaintext password (dev mode)')
    }

    // Update password
    const updateResult = await usersRepo.update(userId, { password: hashedPassword })

    if (updateResult.error) {
      return NextResponse.json(
        { success: false, error: 'Password change failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('[change-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Password change failed' },
      { status: 500 }
    )
  }
}

// Apply CSRF + Authentication
export const POST = withCSRF(withAuth()(handlePOST))

import { NextResponse } from 'next/server'
import { withCSRF } from '@/lib/utils/csrf'

/**
 * POST /api/auth/logout
 * Clear server-side session (if any) and CSRF token
 */
async function handlePOST() {
  try {
    // For dev, we're using localStorage on client-side
    // No server-side session to clear
    // In production with JWT/Supabase Auth, invalidate token here

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Clear CSRF cookie
    response.cookies.set('csrf_token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0 // Expire immediately
    })

    return response
  } catch (error) {
    console.error('[auth/logout]', error)
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}

export const POST = withCSRF(handlePOST)

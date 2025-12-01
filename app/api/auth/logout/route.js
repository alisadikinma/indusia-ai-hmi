import { NextResponse } from 'next/server'

/**
 * POST /api/auth/logout
 * Clear server-side session (if any)
 * Response: { success: true }
 */
export async function POST() {
  try {
    // For dev, we're using localStorage on client-side
    // No server-side session to clear
    // In production with JWT/Supabase Auth, invalidate token here

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('[auth/logout]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

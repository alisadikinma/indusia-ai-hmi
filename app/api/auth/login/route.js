import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Response: { success, data: { user } } or { success: false, error }
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const result = await usersRepo.getByEmail(email)

    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const user = result.data

    // Check password (plaintext for dev - noted in schema)
    // In production, use bcrypt.compare()
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check user status
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Account is not active. Please contact administrator.' },
        { status: 403 }
      )
    }

    // Remove sensitive data before returning
    const { password: _, ...safeUser } = user

    return NextResponse.json({
      success: true,
      data: {
        user: safeUser
      }
    })
  } catch (error) {
    console.error('[auth/login]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

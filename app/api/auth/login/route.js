import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { normalizeRole } from '@/lib/utils/roleUtils'
import { validateMockCredentials } from '@/data/mockUsers'

/**
 * POST /api/auth/login
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { email, password } = body

    console.log('[login] Attempting login for:', email)

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Try Supabase first
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single()

      console.log('[login] Supabase result:', { user: user?.email, error: error?.message })

      if (!error && user) {
        // Check password (supports both plaintext and bcrypt)
        let isValid = false
        
        if (user.password && user.password.startsWith('$2')) {
          // Bcrypt hash
          try {
            const bcrypt = require('bcrypt')
            isValid = await bcrypt.compare(password, user.password)
          } catch (e) {
            console.warn('[login] bcrypt not available')
          }
        } else {
          // Plaintext comparison
          isValid = password === user.password
        }

        console.log('[login] Password valid:', isValid)

        if (isValid && user.status === 'active') {
          const { password: _, ...safeUser } = user
          
          // Add normalized role field
          safeUser.role = normalizeRole(safeUser.role_id)
          
          return NextResponse.json({
            success: true,
            data: { user: safeUser }
          })
        } else if (user.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Account is not active' },
            { status: 403 }
          )
        }
      }
    } catch (dbError) {
      console.warn('[login] Supabase error:', dbError.message)
    }

    // Fallback to mock users
    console.log('[login] Trying mock users...')
    const mockUser = validateMockCredentials(normalizedEmail, password)

    if (mockUser) {
      console.log('[login] Mock user found:', mockUser.email)
      return NextResponse.json({
        success: true,
        data: { user: mockUser },
        _mock: true
      })
    }

    console.log('[login] No user found')
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  } catch (error) {
    console.error('[login] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Login failed: ' + error.message },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

/**
 * Extract simple role name from role_id
 * 'role_superadmin' -> 'superadmin'
 */
function normalizeRole(roleId) {
  if (!roleId) return null;
  return roleId.replace(/^role_/i, '').toLowerCase();
}

// Mock users for development - always available as fallback
const mockUsers = [
  { 
    id: 'user_admin', 
    name: 'Admin User', 
    email: 'admin@indusia.com', 
    password: 'admin123',
    role_id: 'role_superadmin', 
    role: 'superadmin', 
    status: 'active', 
    sections: ['section_smt', 'section_tht', 'section_final'] 
  },
  { 
    id: 'user_manager', 
    name: 'Manager User', 
    email: 'manager@indusia.com', 
    password: 'manager123',
    role_id: 'role_manager', 
    role: 'manager', 
    status: 'active', 
    sections: ['section_smt', 'section_tht'] 
  },
  { 
    id: 'user_operator', 
    name: 'Operator User', 
    email: 'operator@indusia.com', 
    password: 'operator123',
    role_id: 'role_operator', 
    role: 'operator', 
    status: 'active', 
    sections: ['section_smt'] 
  },
  { 
    id: 'user_engineer', 
    name: 'Engineer User', 
    email: 'engineer@indusia.com', 
    password: 'engineer123',
    role_id: 'role_engineer', 
    role: 'engineer', 
    status: 'active', 
    sections: ['section_smt', 'section_tht', 'section_final'] 
  },
]

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
    const mockUser = mockUsers.find(u => 
      u.email.toLowerCase() === normalizedEmail && 
      u.password === password
    )

    if (mockUser && mockUser.status === 'active') {
      console.log('[login] Mock user found:', mockUser.email)
      const { password: _, ...safeUser } = mockUser
      return NextResponse.json({
        success: true,
        data: { user: safeUser },
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

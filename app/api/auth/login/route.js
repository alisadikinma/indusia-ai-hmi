import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { normalizeRole } from '@/lib/utils/roleUtils'
import { validateMockCredentials } from '@/data/mockUsers'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { checkRateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from '@/lib/utils/rateLimit'
import { generateCSRFToken, setCSRFCookie } from '@/lib/utils/csrf'
import { z } from 'zod'

// Validation schema for login
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
}).strict()

/**
 * POST /api/auth/login
 */
async function handlePOST(request) {
  const isDev = process.env.NODE_ENV === 'development'

  try {
    // RATE LIMITING: Prevent brute force attacks
    const clientIP = getClientIP(request)
    const rateCheck = checkRateLimit(
      `login:${clientIP}`,
      RATE_LIMITS.login.maxRequests,
      RATE_LIMITS.login.windowMs
    )

    if (!rateCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse(rateCheck.resetIn),
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + rateCheck.resetIn / 1000).toString()
          }
        }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)

    // Validate input
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password format' },
        { status: 400 }
      )
    }

    const { email, password } = validation.data
    const normalizedEmail = email.toLowerCase().trim()

    if (isDev) {
      console.log('[login] Attempting login for:', normalizedEmail)
    }

    // Try Supabase first
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single()

      if (!error && user) {
        // Check password - prefer bcrypt, fallback to plaintext only in dev
        let isValid = false
        
        if (user.password && user.password.startsWith('$2')) {
          // Bcrypt hash - always supported
          try {
            const bcrypt = require('bcrypt')
            isValid = await bcrypt.compare(password, user.password)
          } catch (e) {
            console.warn('[login] bcrypt comparison failed')
          }
        } else if (isDev) {
          // SECURITY: Plaintext comparison ONLY in development
          isValid = password === user.password
          if (isValid) {
            console.warn('[login] WARNING: Plaintext password match - use bcrypt in production!')
          }
        }
        // In production, plaintext passwords are NOT accepted

        if (isValid && user.status === 'active') {
          const { password: _, ...safeUser } = user
          
          // Add normalized role field
          safeUser.role = normalizeRole(safeUser.role_id)
          
          // Generate new CSRF token on successful login
          const csrfToken = generateCSRFToken()
          
          const response = NextResponse.json({
            success: true,
            data: { 
              user: safeUser,
              csrfToken // Include in response for frontend
            }
          }, {
            headers: {
              'X-RateLimit-Remaining': rateCheck.remaining.toString()
            }
          })
          
          // Set CSRF cookie
          setCSRFCookie(response, csrfToken)
          
          return response
        } else if (user.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Account is not active' },
            { status: 403 }
          )
        }
      }
    } catch (dbError) {
      if (isDev) {
        console.warn('[login] Supabase error:', dbError.message)
      }
    }

    // SECURITY: Mock users ONLY in development mode
    if (isDev) {
      const mockUser = validateMockCredentials(normalizedEmail, password)

      if (mockUser) {
        console.log('[login] Dev mode - Mock user found:', mockUser.email)
        
        // Generate CSRF token for mock login too
        const csrfToken = generateCSRFToken()
        
        const response = NextResponse.json({
          success: true,
          data: { 
            user: mockUser,
            csrfToken
          },
          _mock: true,
          _warning: 'Mock users are for development only'
        })
        
        setCSRFCookie(response, csrfToken)
        
        return response
      }
    }

    // Generic error message to prevent user enumeration
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  } catch (error) {
    console.error('[login] Error:', error)
    // SECURITY: Don't expose internal error details
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    )
  }
}

// Login does NOT need CSRF protection:
// - No existing session to hijack (this IS the session entry point)
// - Rate limiting already protects against brute force
// - Login response generates a fresh CSRF token for subsequent requests
export const POST = handlePOST

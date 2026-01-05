/**
 * GET /api/auth/csrf
 * Returns a new CSRF token and sets it as a cookie
 * Frontend should call this on app load and store the token
 */

import { NextResponse } from 'next/server'
import { generateCSRFToken, setCSRFCookie } from '@/lib/utils/csrf'

export async function GET(request) {
  const token = generateCSRFToken()
  
  const response = NextResponse.json({
    success: true,
    data: { csrfToken: token }
  })

  // Set cookie with the token
  setCSRFCookie(response, token)

  return response
}

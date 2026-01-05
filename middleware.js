import { NextResponse } from 'next/server'

/**
 * Security Middleware for INDUSIA AI HMI
 * Handles route protection and security headers
 */

// Allowed origins for CORS (add production domains as needed)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean)

// Protected routes that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/inspection',
  '/admin',
  '/engineering',
  '/super-admin',
  '/event-log',
  '/settings'
]

// Public paths that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/api/error-log' // Allow error logging without auth
]

/**
 * Add security headers to response
 * @param {NextResponse} response - The response object
 * @returns {NextResponse} Response with security headers
 */
function addSecurityHeaders(response) {
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Enable XSS filter (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // DNS prefetch control
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  // Permissions policy (disable sensitive features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )

  // Content Security Policy (basic - adjust for your needs)
  // Note: This is a relaxed CSP for development; tighten for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Next.js
        "style-src 'self' 'unsafe-inline'", // Needed for Tailwind/CSS-in-JS
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'"
      ].join('; ')
    )
  }

  // Strict Transport Security (for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

/**
 * Add CORS headers for API routes
 * @param {NextResponse} response - The response object
 * @param {Request} request - The incoming request
 * @returns {NextResponse} Response with CORS headers
 */
function addCORSHeaders(response, request) {
  const origin = request.headers.get('origin')

  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    response.headers.set('Access-Control-Allow-Origin', '*')
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-User-Id, X-Requested-With, X-CSRF-Token'
  )
  response.headers.set('Access-Control-Max-Age', '86400')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  return response
}

/**
 * Main middleware function
 */
export function middleware(request) {
  const { pathname } = request.nextUrl

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    addCORSHeaders(response, request)
    return response
  }

  // Check if path is public
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path))

  // Check if path is API route
  const isAPIRoute = pathname.startsWith('/api/')

  // Check if path is protected
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  // Create base response
  let response = NextResponse.next()

  // Add security headers to all responses
  response = addSecurityHeaders(response)

  // Add CORS headers for API routes
  if (isAPIRoute) {
    response = addCORSHeaders(response, request)
  }

  // Authentication check for protected routes
  if (isProtectedPath && !isPublicPath) {
    // For development: Rely on client-side auth check in LayoutClient
    // since localStorage isn't accessible in middleware
    //
    // For production with cookies/JWT:
    // const token = request.cookies.get('auth_token')?.value
    // if (!token) {
    //   return NextResponse.redirect(new URL('/login', request.url))
    // }
    //
    // Optionally validate token here
    // try {
    //   const decoded = verifyToken(token)
    //   if (!decoded) {
    //     return NextResponse.redirect(new URL('/login', request.url))
    //   }
    // } catch {
    //   return NextResponse.redirect(new URL('/login', request.url))
    // }

    // For now, pass through - client-side handles redirect
  }

  // API route protection can be added here
  // if (isAPIRoute && !isPublicPath) {
  //   const authHeader = request.headers.get('authorization')
  //   const userId = request.headers.get('x-user-id')
  //
  //   if (!authHeader && !userId) {
  //     return Response.json(
  //       { success: false, error: 'Unauthorized' },
  //       { status: 401 }
  //     )
  //   }
  // }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)'
  ]
}

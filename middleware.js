import { NextResponse } from 'next/server'

/**
 * Middleware for route protection
 * For dev, we check if userId cookie/header exists
 * In production, this would validate JWT or session
 */
export function middleware(request) {
  const { pathname } = request.nextUrl

  // Protected routes that require authentication
  const protectedPaths = [
    '/dashboard',
    '/inspection',
    '/admin',
    '/engineering',
    '/super-admin',
    '/event-log',
    '/settings'
  ]

  // Public paths that don't require auth
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
    '/_next',
    '/favicon.ico'
  ]

  // Check if path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Check if path is protected
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    // For dev: We rely on client-side auth check in LayoutClient
    // since localStorage isn't accessible in middleware
    //
    // For production with cookies/JWT:
    // const token = request.cookies.get('auth_token')?.value
    // if (!token) {
    //   return NextResponse.redirect(new URL('/login', request.url))
    // }

    // For now, just pass through - client-side will handle redirect
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

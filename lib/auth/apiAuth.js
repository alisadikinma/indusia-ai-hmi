import { createClient } from '@/lib/supabase/server'
import { hasPermission, unauthorizedResponse, forbiddenResponse } from './rbac'

/**
 * Get the authenticated user from a request
 * Supports multiple authentication methods:
 * - x-user-id header (for internal/testing)
 * - Authorization header with Bearer token
 * - Session cookie (future Supabase Auth)
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<Object|null>} The user object or null if not authenticated
 */
export async function getAuthUser(request) {
  try {
    // Method 1: Check x-user-id header (development/internal use)
    const userId = request.headers.get('x-user-id')

    if (userId) {
      const supabase = await createClient()
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role_id, sections, status, whatsapp')
        .eq('id', userId)
        .single()

      if (error || !user) {
        console.warn('[Auth] User not found for ID:', userId)
        return null
      }

      if (user.status !== 'active') {
        console.warn('[Auth] User account is not active:', userId)
        return null
      }

      return user
    }

    // Method 2: Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      // TODO: Implement JWT verification when Supabase Auth is integrated
      // For now, treat the token as a user ID for development
      if (token) {
        const supabase = await createClient()
        const { data: user, error } = await supabase
          .from('users')
          .select('id, name, email, role_id, sections, status, whatsapp')
          .eq('id', token)
          .single()

        if (!error && user && user.status === 'active') {
          return user
        }
      }
    }

    // Method 3: Check session cookie (future implementation)
    // const sessionCookie = request.cookies.get('session')
    // if (sessionCookie) { ... }

    return null
  } catch (error) {
    console.error('[Auth] Error getting authenticated user:', error)
    return null
  }
}

/**
 * Higher-order function to wrap API handlers with authentication
 * @param {string|null} permission - Optional permission required (null for auth only)
 * @returns {Function} Wrapper function
 */
export function withAuth(permission = null) {
  return (handler) => {
    return async (request, context) => {
      // Get authenticated user
      const user = await getAuthUser(request)

      if (!user) {
        return unauthorizedResponse()
      }

      // Check permission if specified
      if (permission && !hasPermission(user.role_id, permission)) {
        return forbiddenResponse(`Permission '${permission}' required`)
      }

      // Attach user to request for handler access
      request.user = user

      // Call the original handler
      return handler(request, context)
    }
  }
}

/**
 * Wrapper for handlers that require any of multiple permissions
 * @param {string[]} permissions - Array of permissions (any one is sufficient)
 * @returns {Function} Wrapper function
 */
export function withAnyPermission(permissions) {
  return (handler) => {
    return async (request, context) => {
      const user = await getAuthUser(request)

      if (!user) {
        return unauthorizedResponse()
      }

      const hasAny = permissions.some(perm => hasPermission(user.role_id, perm))
      if (!hasAny) {
        return forbiddenResponse(`One of permissions required: ${permissions.join(', ')}`)
      }

      request.user = user
      return handler(request, context)
    }
  }
}

/**
 * Optional authentication - attaches user if available but doesn't require it
 * @param {Function} handler - The API handler
 * @returns {Function} Wrapped handler
 */
export function withOptionalAuth(handler) {
  return async (request, context) => {
    const user = await getAuthUser(request)
    request.user = user // May be null
    return handler(request, context)
  }
}

/**
 * Validate that the current user can access/modify a specific user's data
 * (Users can only access their own data unless they have admin permissions)
 * @param {Object} currentUser - The authenticated user
 * @param {string} targetUserId - The user ID being accessed
 * @param {string} permission - Permission that allows access to other users
 * @returns {boolean} True if access is allowed
 */
export function canAccessUser(currentUser, targetUserId, permission = 'users:read') {
  if (!currentUser) return false

  // User can always access their own data
  if (currentUser.id === targetUserId) return true

  // Check if user has permission to access other users
  return hasPermission(currentUser.role_id, permission)
}

/**
 * Extract client info from request for logging/auditing
 * @param {Request} request - The incoming request
 * @returns {Object} Client information
 */
export function getClientInfo(request) {
  return {
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    referer: request.headers.get('referer') || null,
    origin: request.headers.get('origin') || null
  }
}

/**
 * Check if the request is from an internal/trusted source
 * @param {Request} request - The incoming request
 * @returns {boolean} True if request is from trusted source
 */
export function isTrustedSource(request) {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ].filter(Boolean)

  return !origin || allowedOrigins.includes(origin)
}

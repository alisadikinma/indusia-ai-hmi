import { createClient } from '@/lib/supabase/server'
import { hasPermission, unauthorizedResponse, forbiddenResponse } from './rbac'

/**
 * Get the authenticated user from a request
 * Supports multiple authentication methods:
 * - x-user-id header (DEVELOPMENT ONLY - disabled in production)
 * - Authorization header with Bearer token
 * - Session cookie (future Supabase Auth)
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<Object|null>} The user object or null if not authenticated
 */
export async function getAuthUser(request) {
  try {
    const isDev = process.env.NODE_ENV === 'development'

    // Method 1: Check x-user-id header (DEVELOPMENT ONLY)
    // SECURITY: This is disabled in production to prevent header spoofing
    if (isDev) {
      const userId = request.headers.get('x-user-id')

      if (userId) {
        const supabase = await createClient()
        const { data: user, error } = await supabase
          .from('users')
          .select('id, name, email, role_id, sections, status, whatsapp')
          .eq('id', userId)
          .single()

        if (isDev) {
          console.log('[Auth] Dev mode - userId:', userId, 'found:', !!user)
        }

        if (error || !user) {
          return null
        }

        if (user.status !== 'active') {
          return null
        }

        return user
      }
    }

    // Method 2: Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      if (token) {
        const supabase = await createClient()
        
        // Try to verify as Supabase Auth token first
        try {
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
          
          if (!authError && authUser) {
            const { data: user, error } = await supabase
              .from('users')
              .select('id, name, email, role_id, sections, status, whatsapp')
              .eq('id', authUser.id)
              .single()

            if (!error && user && user.status === 'active') {
              return user
            }
          }
        } catch (e) {
          // Token is not a Supabase Auth token
        }

        // Fallback: In development, treat token as user ID for testing
        if (isDev) {
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
    }

    // Method 3: Check session cookie (for browser-based auth)
    const cookies = request.cookies || request.headers.get('cookie')
    if (cookies) {
      // Parse session from cookie if using Supabase Auth
      const sessionCookie = typeof cookies === 'string' 
        ? cookies.split(';').find(c => c.trim().startsWith('sb-'))
        : cookies.get?.('sb-access-token')?.value
      
      if (sessionCookie) {
        const supabase = await createClient()
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        
        if (!error && authUser) {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, role_id, sections, status, whatsapp')
            .eq('id', authUser.id)
            .single()

          if (!userError && user && user.status === 'active') {
            return user
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('[Auth] Error getting authenticated user:', error.message)
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
      console.log(`[withAuth] Checking permission: ${permission}`)
      
      // Get authenticated user
      const user = await getAuthUser(request)
      console.log(`[withAuth] User found:`, user?.id, 'role:', user?.role_id)

      if (!user) {
        console.log(`[withAuth] No user - returning 401`)
        return unauthorizedResponse()
      }

      // Check permission if specified
      if (permission) {
        const allowed = hasPermission(user.role_id, permission)
        console.log(`[withAuth] hasPermission(${user.role_id}, ${permission}) =`, allowed)
        if (!allowed) {
          console.warn(`[withAuth] Permission denied: ${permission} for role ${user.role_id}`)
          return forbiddenResponse(`Permission '${permission}' required`)
        }
      }

      // Attach user to request for handler access
      request.user = user
      console.log(`[withAuth] Auth passed, calling handler`)

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

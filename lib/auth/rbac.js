/**
 * Role-Based Access Control (RBAC) module for INDUSIA AI HMI
 * Defines permissions and provides helpers for access control
 */

// ============================================
// Permission Definitions
// ============================================

/**
 * Permission map: permission_name -> array of allowed roles
 * Format: 'resource:action' -> ['role1', 'role2']
 */
export const PERMISSIONS = {
  // User management
  'users:read': ['superadmin', 'manager'],
  'users:create': ['superadmin'],
  'users:update': ['superadmin'],
  'users:delete': ['superadmin'],

  // Role management
  'roles:read': ['superadmin'],
  'roles:create': ['superadmin'],
  'roles:update': ['superadmin'],
  'roles:delete': ['superadmin'],

  // Permission management
  'permissions:read': ['superadmin'],
  'permissions:update': ['superadmin'],

  // Override management
  'overrides:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'overrides:create': ['operator'],
  'overrides:review': ['manager', 'superadmin'],
  'overrides:delete': ['superadmin'],

  // Model management
  'models:read': ['engineer', 'superadmin'],
  'models:create': ['engineer', 'superadmin'],
  'models:update': ['engineer', 'superadmin'],
  'models:deploy': ['engineer', 'superadmin'],
  'models:delete': ['superadmin'],

  // Master data management
  'masterdata:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'masterdata:create': ['engineer', 'superadmin'],
  'masterdata:update': ['engineer', 'superadmin'],
  'masterdata:delete': ['superadmin'],

  // Notification management
  'notifications:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'notifications:create': ['manager', 'engineer', 'superadmin'],
  'notifications:update': ['operator', 'manager', 'engineer', 'superadmin'],

  // Event log access
  'eventlog:read': ['manager', 'engineer', 'superadmin'],
  'eventlog:export': ['manager', 'engineer', 'superadmin'],

  // System management
  'system:read': ['manager', 'engineer', 'superadmin'],
  'system:configure': ['superadmin'],
  'system:sync': ['engineer', 'superadmin'],

  // Admin panel access
  'admin:access': ['superadmin'],

  // Dashboard access
  'dashboard:operator': ['operator', 'manager', 'engineer', 'superadmin'],
  'dashboard:manager': ['manager', 'engineer', 'superadmin'],
  'dashboard:engineer': ['engineer', 'superadmin'],
  'dashboard:admin': ['superadmin'],

  // Inspection operations
  'inspection:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'inspection:create': ['operator', 'manager', 'engineer', 'superadmin'],
  'inspection:update': ['operator', 'manager', 'engineer', 'superadmin'],
  'inspection:delete': ['superadmin']
}

// ============================================
// Role Hierarchy
// ============================================

/**
 * Role hierarchy - higher roles inherit permissions from lower roles
 * superadmin > engineer > manager > operator
 */
export const ROLE_HIERARCHY = {
  operator: 0,
  manager: 1,
  engineer: 2,
  superadmin: 3
}

// ============================================
// Permission Helpers
// ============================================

/**
 * Check if a user role has a specific permission
 * @param {string} userRole - The user's role ID
 * @param {string} permission - The permission to check (e.g., 'users:create')
 * @returns {boolean} True if the role has the permission
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false

  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles) {
    console.warn(`[RBAC] Unknown permission: ${permission}`)
    return false
  }

  return allowedRoles.includes(userRole)
}

/**
 * Check if a user role has any of the specified permissions
 * @param {string} userRole - The user's role ID
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} True if the role has any of the permissions
 */
export function hasAnyPermission(userRole, permissions) {
  return permissions.some(permission => hasPermission(userRole, permission))
}

/**
 * Check if a user role has all of the specified permissions
 * @param {string} userRole - The user's role ID
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} True if the role has all the permissions
 */
export function hasAllPermissions(userRole, permissions) {
  return permissions.every(permission => hasPermission(userRole, permission))
}

/**
 * Get all permissions for a specific role
 * @param {string} userRole - The user's role ID
 * @returns {string[]} Array of permission names the role has
 */
export function getPermissionsForRole(userRole) {
  if (!userRole) return []

  return Object.entries(PERMISSIONS)
    .filter(([, allowedRoles]) => allowedRoles.includes(userRole))
    .map(([permission]) => permission)
}

/**
 * Check if role A is higher than or equal to role B in hierarchy
 * @param {string} roleA - First role
 * @param {string} roleB - Second role
 * @returns {boolean} True if roleA >= roleB
 */
export function isRoleHigherOrEqual(roleA, roleB) {
  const levelA = ROLE_HIERARCHY[roleA] ?? -1
  const levelB = ROLE_HIERARCHY[roleB] ?? -1
  return levelA >= levelB
}

/**
 * Check if user can manage another user (based on role hierarchy)
 * Users can only manage users with lower roles
 * @param {string} managerRole - The manager's role
 * @param {string} targetRole - The target user's role
 * @returns {boolean} True if manager can manage target
 */
export function canManageUser(managerRole, targetRole) {
  const managerLevel = ROLE_HIERARCHY[managerRole] ?? -1
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? -1

  // Must be strictly higher to manage
  return managerLevel > targetLevel
}

// ============================================
// Middleware Helpers
// ============================================

/**
 * Create a permission checker function for API routes
 * @param {string} permission - The required permission
 * @returns {Function} Function that checks permission and throws if denied
 */
export function requirePermission(permission) {
  return async (request, user) => {
    if (!user) {
      const error = new Error('Unauthorized')
      error.statusCode = 401
      error.code = 'UNAUTHORIZED'
      throw error
    }

    if (!hasPermission(user.role_id, permission)) {
      const error = new Error('Forbidden: Insufficient permissions')
      error.statusCode = 403
      error.code = 'FORBIDDEN'
      error.details = {
        required: permission,
        userRole: user.role_id
      }
      throw error
    }

    return true
  }
}

/**
 * Create a permission checker for any of multiple permissions
 * @param {string[]} permissions - Array of permissions (any one is sufficient)
 * @returns {Function} Function that checks permission and throws if denied
 */
export function requireAnyPermission(permissions) {
  return async (request, user) => {
    if (!user) {
      const error = new Error('Unauthorized')
      error.statusCode = 401
      error.code = 'UNAUTHORIZED'
      throw error
    }

    if (!hasAnyPermission(user.role_id, permissions)) {
      const error = new Error('Forbidden: Insufficient permissions')
      error.statusCode = 403
      error.code = 'FORBIDDEN'
      error.details = {
        required: permissions,
        userRole: user.role_id
      }
      throw error
    }

    return true
  }
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create a 401 Unauthorized response
 * @param {string} message - Optional custom message
 * @returns {Response}
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json(
    { success: false, error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  )
}

/**
 * Create a 403 Forbidden response
 * @param {string} message - Optional custom message
 * @returns {Response}
 */
export function forbiddenResponse(message = 'Forbidden') {
  return Response.json(
    { success: false, error: message, code: 'FORBIDDEN' },
    { status: 403 }
  )
}

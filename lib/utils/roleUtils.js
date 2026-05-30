/**
 * Role Utilities
 * Centralized role normalization and helpers
 */

/**
 * Extract simple role name from role_id
 * Handles formats like:
 * - 'role_superadmin' -> 'superadmin'
 * - 'role_manager' -> 'manager'
 * - 'superadmin' -> 'superadmin' (already normalized)
 *
 * @param {string} roleId - The role ID to normalize
 * @returns {string|null} - Normalized role name
 */
export function normalizeRole(roleId) {
  if (!roleId) return null
  return roleId.replace(/^role_/i, '').toLowerCase()
}

/**
 * Get role_id from normalized role name
 *
 * @param {string} role - Normalized role name
 * @returns {string} - Full role_id
 */
export function toRoleId(role) {
  if (!role) return null
  if (role.startsWith('role_')) return role
  return `role_${role.toLowerCase()}`
}

/**
 * Check if user has specific role
 *
 * @param {object} user - User object with role or role_id
 * @param {string|string[]} allowedRoles - Role(s) to check
 * @returns {boolean}
 */
export function hasRole(user, allowedRoles) {
  if (!user) return false

  const userRole = user.role || normalizeRole(user.role_id)
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  return roles.includes(userRole)
}

/**
 * Check if user is super admin
 *
 * @param {object} user - User object
 * @returns {boolean}
 */
export function isSuperAdmin(user) {
  return hasRole(user, 'superadmin')
}

/**
 * Check if user has manager or higher privileges
 *
 * @param {object} user - User object
 * @returns {boolean}
 */
export function isManagerOrAbove(user) {
  return hasRole(user, ['manager', 'superadmin'])
}

export default {
  normalizeRole,
  toRoleId,
  hasRole,
  isSuperAdmin,
  isManagerOrAbove
}

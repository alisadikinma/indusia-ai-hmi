/**
 * Audit Logging Module for INDUSIA AI HMI
 * Logs sensitive actions for security compliance and debugging
 */

import { supabase } from '@/lib/supabaseClient'

// ============================================
// Sensitive Actions Configuration
// ============================================

/**
 * Actions that should always be audited
 */
export const SENSITIVE_ACTIONS = [
  // User management
  'users:create',
  'users:update',
  'users:delete',
  'users:password_change',
  'users:status_change',

  // Role management
  'roles:create',
  'roles:update',
  'roles:delete',

  // Permission management
  'permissions:update',
  'permissions:bulk_update',

  // Authentication
  'auth:login',
  'auth:logout',
  'auth:login_failed',
  'auth:password_change',
  'auth:session_expired',

  // Model management
  'models:deploy',
  'models:create',
  'models:delete',

  // Override management
  'overrides:review',
  'overrides:bulk_approve',
  'overrides:bulk_reject',

  // System configuration
  'system:config_change',
  'system:sync_trigger',

  // Data operations
  'data:export',
  'data:import',
  'data:bulk_delete'
]

/**
 * Action severity levels for filtering
 */
export const ACTION_SEVERITY = {
  'users:delete': 'CRITICAL',
  'roles:delete': 'CRITICAL',
  'models:deploy': 'WARNING',
  'auth:login_failed': 'WARNING',
  'system:config_change': 'WARNING',
  'data:bulk_delete': 'CRITICAL',
  'permissions:bulk_update': 'WARNING'
}

// ============================================
// Audit Log Functions
// ============================================

/**
 * Log an audit event
 * @param {string} action - The action being performed
 * @param {Object} user - The user performing the action
 * @param {Object} details - Additional details about the action
 * @returns {Promise<void>}
 */
export async function auditLog(action, user, details = {}) {
  // Only audit sensitive actions
  if (!SENSITIVE_ACTIONS.includes(action)) {
    return
  }

  const severity = ACTION_SEVERITY[action] || 'INFO'
  const timestamp = new Date().toISOString()

  const auditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    type: `AUDIT_${action.toUpperCase().replace(':', '_')}`,
    source: 'SECURITY',
    severity,
    user_id: user?.id || null,
    user_name: user?.name || 'Unknown',
    role_id: user?.role_id || null,
    section_id: details.section_id || null,
    details: {
      action,
      ...sanitizeAuditDetails(details),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      timestamp
    }
  }

  try {
    const { error } = await supabase
      .from('event_log')
      .insert(auditEntry)

    if (error) {
      console.error('[Audit] Failed to log audit event:', error)
      // Fallback to console logging
      console.warn('[Audit] Event:', JSON.stringify(auditEntry))
    }
  } catch (err) {
    console.error('[Audit] Exception during audit logging:', err)
    console.warn('[Audit] Event:', JSON.stringify(auditEntry))
  }
}

/**
 * Sanitize details before storing in audit log
 * Removes sensitive data like passwords
 * @param {Object} details - Details to sanitize
 * @returns {Object} Sanitized details
 */
function sanitizeAuditDetails(details) {
  const sensitiveFields = [
    'password',
    'current_password',
    'new_password',
    'confirm_password',
    'token',
    'secret',
    'api_key',
    'apiKey'
  ]

  const sanitized = { ...details }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  // Recursively sanitize nested objects
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeAuditDetails(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Helper to create audit log with request context
 * @param {string} action - The action being performed
 * @param {Object} user - The user performing the action
 * @param {Request} request - The request object
 * @param {Object} details - Additional details
 * @returns {Promise<void>}
 */
export async function auditLogWithRequest(action, user, request, details = {}) {
  const clientInfo = {
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    referer: request.headers.get('referer') || null,
    method: request.method,
    url: request.url
  }

  await auditLog(action, user, { ...details, ...clientInfo })
}

// ============================================
// Specific Audit Helpers
// ============================================

/**
 * Log user creation
 */
export async function auditUserCreated(user, createdUser, request) {
  await auditLogWithRequest('users:create', user, request, {
    createdUserId: createdUser.id,
    createdUserEmail: createdUser.email,
    createdUserRole: createdUser.role_id
  })
}

/**
 * Log user update
 */
export async function auditUserUpdated(user, targetUserId, changes, request) {
  await auditLogWithRequest('users:update', user, request, {
    targetUserId,
    changes: Object.keys(changes)
  })
}

/**
 * Log user deletion
 */
export async function auditUserDeleted(user, deletedUserId, request) {
  await auditLogWithRequest('users:delete', user, request, {
    deletedUserId
  })
}

/**
 * Log successful login
 */
export async function auditLogin(user, request) {
  await auditLogWithRequest('auth:login', user, request, {
    loginTime: new Date().toISOString()
  })
}

/**
 * Log failed login attempt
 */
export async function auditLoginFailed(email, reason, request) {
  await auditLogWithRequest('auth:login_failed', { name: email }, request, {
    email,
    reason,
    attemptTime: new Date().toISOString()
  })
}

/**
 * Log logout
 */
export async function auditLogout(user, request) {
  await auditLogWithRequest('auth:logout', user, request, {
    logoutTime: new Date().toISOString()
  })
}

/**
 * Log password change
 */
export async function auditPasswordChange(user, request) {
  await auditLogWithRequest('users:password_change', user, request, {
    changeTime: new Date().toISOString()
  })
}

/**
 * Log model deployment
 */
export async function auditModelDeploy(user, modelId, modelVersion, request) {
  await auditLogWithRequest('models:deploy', user, request, {
    modelId,
    modelVersion,
    deployTime: new Date().toISOString()
  })
}

/**
 * Log override review
 */
export async function auditOverrideReview(user, overrideId, action, request) {
  await auditLogWithRequest('overrides:review', user, request, {
    overrideId,
    reviewAction: action,
    reviewTime: new Date().toISOString()
  })
}

/**
 * Log permission update
 */
export async function auditPermissionUpdate(user, roleId, changes, request) {
  await auditLogWithRequest('permissions:update', user, request, {
    roleId,
    permissionChanges: changes
  })
}

/**
 * Log data export
 */
export async function auditDataExport(user, exportType, recordCount, request) {
  await auditLogWithRequest('data:export', user, request, {
    exportType,
    recordCount,
    exportTime: new Date().toISOString()
  })
}

// ============================================
// Query Audit Logs
// ============================================

/**
 * Get audit logs with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of audit entries
 */
export async function getAuditLogs(filters = {}) {
  const {
    userId,
    action,
    severity,
    from,
    to,
    limit = 100,
    offset = 0
  } = filters

  let query = supabase
    .from('event_log')
    .select('*', { count: 'exact' })
    .like('type', 'AUDIT_%')
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (action) {
    query = query.eq('type', `AUDIT_${action.toUpperCase().replace(':', '_')}`)
  }

  if (severity) {
    query = query.eq('severity', severity)
  }

  if (from) {
    query = query.gte('timestamp', from)
  }

  if (to) {
    query = query.lte('timestamp', to)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[Audit] Failed to fetch audit logs:', error)
    return { data: [], total: 0 }
  }

  return { data, total: count }
}

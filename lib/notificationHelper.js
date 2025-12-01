/**
 * Notification Helper
 * Non-blocking notification creation for users
 */

/**
 * Create a notification for a specific user
 * @param {Object} notification - Notification data
 * @param {string} notification.userId - Target user ID (null for broadcast)
 * @param {string} notification.type - Notification type (SYSTEM, WORKFLOW, ALERT)
 * @param {string} notification.category - Category (OVERRIDE_SUBMITTED, OVERRIDE_APPROVED, etc.)
 * @param {string} notification.title - Notification title
 * @param {string} notification.message - Notification message
 * @param {string} notification.severity - Severity level (INFO, WARNING, ERROR, SUCCESS)
 */
export async function notifyUser({
  userId,
  type = 'WORKFLOW',
  category,
  title,
  message,
  severity = 'INFO'
}) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        type,
        category,
        title,
        message,
        severity,
        created_at: new Date().toISOString(),
        read: false
      })
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
    // Non-blocking - don't throw
  }
}

/**
 * Notify managers about a new override submission
 * @param {Object} override - Override data
 */
export async function notifyManagersNewOverride(override) {
  await notifyUser({
    userId: null, // Broadcast to all managers (handled by role filter in backend)
    type: 'WORKFLOW',
    category: 'OVERRIDE_SUBMITTED',
    title: 'New Override Submitted',
    message: `New override submitted for board ${override.boardId || override.board_id} by ${override.operatorName || override.operator_name}`,
    severity: 'INFO'
  })
}

/**
 * Notify operator that their override was approved
 * @param {string} operatorId - Operator user ID
 * @param {Object} override - Override data
 */
export async function notifyOverrideApproved(operatorId, override) {
  await notifyUser({
    userId: operatorId,
    type: 'WORKFLOW',
    category: 'OVERRIDE_APPROVED',
    title: 'Override Approved',
    message: `Your override request for board ${override.boardId || override.board_id} has been approved`,
    severity: 'SUCCESS'
  })
}

/**
 * Notify operator that their override was rejected
 * @param {string} operatorId - Operator user ID
 * @param {Object} override - Override data
 * @param {string} reason - Rejection reason
 */
export async function notifyOverrideRejected(operatorId, override, reason = '') {
  await notifyUser({
    userId: operatorId,
    type: 'WORKFLOW',
    category: 'OVERRIDE_REJECTED',
    title: 'Override Rejected',
    message: `Your override request for board ${override.boardId || override.board_id} has been rejected${reason ? `: ${reason}` : ''}`,
    severity: 'WARNING'
  })
}

export default {
  notifyUser,
  notifyManagersNewOverride,
  notifyOverrideApproved,
  notifyOverrideRejected
}

/**
 * Notification Helper
 * Non-blocking notification creation for users and role-based broadcasts
 */

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001'

/**
 * Get users by role names
 * @param {string[]} roleNames - Array of role names (e.g., ['manager', 'engineer'])
 * @returns {Promise<Array>} - Array of user objects
 */
async function getUsersByRoles(roleNames) {
  try {
    // Get role IDs first
    const rolesRes = await fetch(
      `${POSTGREST_URL}/roles?name=in.(${roleNames.map(r => `"${r}"`).join(',')})`,
      { headers: { 'Accept': 'application/json' } }
    )
    const roles = await rolesRes.json()
    
    if (!roles || roles.length === 0) return []
    
    const roleIds = roles.map(r => r.id)
    
    // Get users with those roles
    const usersRes = await fetch(
      `${POSTGREST_URL}/users?role_id=in.(${roleIds.join(',')})&status=eq.active`,
      { headers: { 'Accept': 'application/json' } }
    )
    const users = await usersRes.json()
    
    return users || []
  } catch (error) {
    console.error('Failed to get users by roles:', error)
    return []
  }
}

/**
 * Create a notification for a specific user (via PostgREST local DB)
 * @param {Object} notification - Notification data
 */
export async function notifyUser({
  userId,
  type = 'WORKFLOW',
  category,
  title,
  message,
  severity = 'INFO',
  metadata = {}
}) {
  if (!userId) {
    console.warn('[Notification] Missing userId, skipping notification')
    return
  }

  try {
    const response = await fetch(`${POSTGREST_URL}/notifications`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        type,
        category,
        title,
        message,
        severity,
        metadata: JSON.stringify(metadata),
        created_at: new Date().toISOString(),
        read: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Notification] Failed to create:', errorText)
    }
  } catch (error) {
    console.error('[Notification] Error:', error)
    // Non-blocking - don't throw
  }
}

/**
 * Broadcast notification to all users with specific roles
 * @param {string[]} roleNames - Array of role names
 * @param {Object} notification - Notification data (without userId)
 */
export async function notifyRoles(roleNames, notification) {
  try {
    const users = await getUsersByRoles(roleNames)
    
    if (users.length === 0) {
      console.log(`[Notification] No users found with roles: ${roleNames.join(', ')}`)
      return
    }

    console.log(`[Notification] Broadcasting to ${users.length} users with roles: ${roleNames.join(', ')}`)
    
    // Create notification for each user
    await Promise.all(
      users.map(user => notifyUser({
        userId: user.id,
        ...notification
      }))
    )
  } catch (error) {
    console.error('[Notification] Broadcast error:', error)
  }
}

// ============================================
// FALSE CALL NOTIFICATIONS
// ============================================

/**
 * Notify managers about a new false call submission that needs approval
 * Called when operator submits a false call
 * @param {Object} override - Override data
 */
export async function notifyManagersNewOverride(override) {
  await notifyRoles(['manager'], {
    type: 'WORKFLOW',
    category: 'OVERRIDE_SUBMITTED',
    title: 'False Call Baru Menunggu Approval',
    message: `Board ${override.boardId || override.board_id} - disubmit oleh ${override.operatorName || override.operator_name || 'Operator'}`,
    severity: 'INFO',
    metadata: {
      overrideId: override.id,
      boardId: override.boardId || override.board_id,
      workOrderId: override.workOrderId || override.work_order_id
    }
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
    title: 'Override Disetujui',
    message: `Override untuk board ${override.boardId || override.board_id} telah disetujui`,
    severity: 'SUCCESS',
    metadata: {
      overrideId: override.id,
      boardId: override.boardId || override.board_id
    }
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
    title: 'Override Ditolak',
    message: `Override untuk board ${override.boardId || override.board_id} ditolak${reason ? `: ${reason}` : ''}`,
    severity: 'WARNING',
    metadata: {
      overrideId: override.id,
      boardId: override.boardId || override.board_id,
      reason
    }
  })
}

// ============================================
// WORK ORDER NOTIFICATIONS
// ============================================

/**
 * Notify managers and engineers when a Work Order starts
 * @param {Object} workOrder - Work Order data
 */
export async function notifyWorkOrderStarted(workOrder) {
  await notifyRoles(['manager', 'engineer'], {
    type: 'WORKFLOW',
    category: 'WO_STARTED',
    title: 'Work Order Dimulai',
    message: `${workOrder.woNumber || workOrder.wo_number} telah dimulai pada line ${workOrder.lineName || workOrder.line_name || 'N/A'}`,
    severity: 'INFO',
    metadata: {
      workOrderId: workOrder.id,
      woNumber: workOrder.woNumber || workOrder.wo_number,
      lineId: workOrder.lineId || workOrder.line_id
    }
  })
}

/**
 * Notify managers and engineers when a Work Order ends/completes
 * @param {Object} workOrder - Work Order data
 * @param {Object} summary - Summary statistics
 */
export async function notifyWorkOrderCompleted(workOrder, summary = {}) {
  const { goodQty = 0, ngQty = 0, falseCallQty = 0 } = summary
  
  await notifyRoles(['manager', 'engineer'], {
    type: 'WORKFLOW',
    category: 'WO_COMPLETED',
    title: 'Work Order Selesai',
    message: `${workOrder.woNumber || workOrder.wo_number} selesai. Good: ${goodQty}, NG: ${ngQty}, False Call: ${falseCallQty}`,
    severity: 'SUCCESS',
    metadata: {
      workOrderId: workOrder.id,
      woNumber: workOrder.woNumber || workOrder.wo_number,
      goodQty,
      ngQty,
      falseCallQty
    }
  })
}

/**
 * Notify managers when Work Order has quality issues
 * @param {Object} workOrder - Work Order data  
 * @param {string} issue - Issue description
 */
export async function notifyWorkOrderAlert(workOrder, issue) {
  await notifyRoles(['manager'], {
    type: 'ALERT',
    category: 'WO_ALERT',
    title: 'Alert: Work Order',
    message: `${workOrder.woNumber || workOrder.wo_number}: ${issue}`,
    severity: 'WARNING',
    metadata: {
      workOrderId: workOrder.id,
      woNumber: workOrder.woNumber || workOrder.wo_number,
      issue
    }
  })
}

// ============================================
// SYSTEM NOTIFICATIONS
// ============================================

/**
 * Notify all managers about system events
 * @param {string} title - Event title
 * @param {string} message - Event message
 * @param {string} severity - INFO, WARNING, ERROR
 */
export async function notifySystemEvent(title, message, severity = 'INFO') {
  await notifyRoles(['manager', 'super_admin'], {
    type: 'SYSTEM',
    category: 'SYSTEM_EVENT',
    title,
    message,
    severity
  })
}

export default {
  notifyUser,
  notifyRoles,
  notifyManagersNewOverride,
  notifyOverrideApproved,
  notifyOverrideRejected,
  notifyWorkOrderStarted,
  notifyWorkOrderCompleted,
  notifyWorkOrderAlert,
  notifySystemEvent
}

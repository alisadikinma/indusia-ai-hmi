/**
 * Event Logger Helper
 * Non-blocking event logging for system activities
 */

/**
 * Log an event to the event log
 * @param {Object} event - Event data
 * @param {string} event.type - Event type (OVERRIDE_SUBMIT, OVERRIDE_APPROVED, etc.)
 * @param {string} event.source - Event source (HMI, ADMIN_CONSOLE, SYSTEM)
 * @param {string} event.userId - User ID who triggered the event
 * @param {Object} event.details - Additional event details
 */
export async function logEvent({ type, source = 'HMI', userId, details = {} }) {
  try {
    await fetch('/api/event-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        source,
        user_id: userId,
        timestamp: new Date().toISOString(),
        details
      })
    })
  } catch (error) {
    console.error('Failed to log event:', error)
    // Non-blocking - don't throw
  }
}

/**
 * Log override submission event
 * @param {string} userId - User ID
 * @param {Object} details - Override details
 */
export async function logOverrideSubmit(userId, details) {
  await logEvent({
    type: 'OVERRIDE_SUBMIT',
    source: 'HMI',
    userId,
    details
  })
}

/**
 * Log override approval event
 * @param {string} userId - Reviewer user ID
 * @param {Object} details - Approval details
 */
export async function logOverrideApproved(userId, details) {
  await logEvent({
    type: 'OVERRIDE_APPROVED',
    source: 'ADMIN_CONSOLE',
    userId,
    details
  })
}

/**
 * Log override rejection event
 * @param {string} userId - Reviewer user ID
 * @param {Object} details - Rejection details
 */
export async function logOverrideRejected(userId, details) {
  await logEvent({
    type: 'OVERRIDE_REJECTED',
    source: 'ADMIN_CONSOLE',
    userId,
    details
  })
}

export default {
  logEvent,
  logOverrideSubmit,
  logOverrideApproved,
  logOverrideRejected
}

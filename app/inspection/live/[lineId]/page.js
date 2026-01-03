'use client'

/**
 * Live Inspection Page
 * Real-time inspection monitoring for a specific line
 * 
 * Flow:
 * - Operators: Can perform actions (APPROVE/REJECT/FALSE CALL), session tracked
 * - Other roles: View-only mode
 * 
 * V2: Uses redesigned LiveViewV2 with split-screen layout
 */

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { LiveViewV2 } from '@/components/inspection/LiveViewV2'

export default function LiveInspectionPage() {
  const params = useParams()
  const router = useRouter()
  const { lineId } = params
  const { user, isOperator, setActiveLine, clearActiveLine, activeLineId } = useAuth()

  // Get line details from user context or master data
  const lineName = `Line ${lineId}`
  const sectionId = user?.selectedSection || null
  const customerId = user?.selectedCustomer || null

  // Set active line for operators when entering
  useEffect(() => {
    if (isOperator && lineId && !activeLineId) {
      setActiveLine(lineId, lineName)
    }
  }, [isOperator, lineId, lineName, activeLineId, setActiveLine])

  // Check user access
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-3">LOADING...</h2>
          <p className="text-sm font-mono text-text-tertiary">
            Verifying credentials
          </p>
        </div>
      </div>
    )
  }

  // Role check - operators, managers, engineers can view live inspection
  const allowedRoles = ['operator', 'manager', 'engineer', 'superadmin']
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <h2 className="text-xl font-display font-bold text-phosphor-red mb-3">ACCESS DENIED</h2>
          <p className="text-sm font-mono text-text-tertiary">
            Insufficient permissions for live inspection
          </p>
        </div>
      </div>
    )
  }

  const handleExit = () => {
    // Clear active line for operators (terminates session)
    if (isOperator) {
      clearActiveLine()
    }
    router.push('/inspection/select-line')
  }

  return (
    <LiveViewV2
      lineId={lineId}
      lineName={lineName}
      sectionId={sectionId}
      customerId={customerId}
      user={user}
      onExit={handleExit}
      isOperator={isOperator}
    />
  )
}

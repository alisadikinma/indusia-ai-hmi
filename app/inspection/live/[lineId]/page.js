'use client'

/**
 * Live Inspection Page
 * Real-time inspection monitoring for a specific line
 */

import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { LiveView } from '@/components/inspection/LiveView'

export default function LiveInspectionPage() {
  const params = useParams()
  const { lineId } = params
  const { user } = useAuth()

  // Get line details from user context or master data
  // For now, derive from lineId
  const lineName = `Line ${lineId}`
  const sectionId = user?.selectedSection || null
  const customerId = user?.selectedCustomer || null

  // Check user access
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indusia-bg">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Loading...</h2>
          <p className="text-sm text-indusia-textMuted">
            Please wait while we verify your credentials.
          </p>
        </div>
      </div>
    )
  }

  // Role check - operators, managers, engineers can view live inspection
  const allowedRoles = ['operator', 'manager', 'engineer', 'superadmin']
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indusia-bg">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted">
            You do not have permission to access live inspection.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen">
      <LiveView
        lineId={lineId}
        lineName={lineName}
        sectionId={sectionId}
        customerId={customerId}
        user={user}
      />
    </div>
  )
}

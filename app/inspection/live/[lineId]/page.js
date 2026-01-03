'use client'

/**
 * Live Inspection Page
 * Real-time inspection monitoring for a specific line
 * 
 * Flow:
 * - Operators: Can perform actions (APPROVE/FALSE CALL), session tracked
 * - Other roles: View-only mode
 * 
 * V3: Work Order integrated version
 * - Loads active WO for the line
 * - 2-button flow: APPROVE / FALSE CALL
 * - Side tracking for 2-sided PCB
 * - Auto-proceed on GOOD detection (15s countdown)
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/utils/authFetch'
import { LiveViewV3 } from '@/components/inspection/LiveViewV3'

export default function LiveInspectionPage() {
  const params = useParams()
  const router = useRouter()
  const { lineId } = params
  const { user, isOperator, setActiveLine, clearActiveLine, activeLineId } = useAuth()
  
  // State for line details
  const [lineDetails, setLineDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  // Get line details from user context or master data
  const lineName = lineDetails?.name || `Line ${lineId}`
  const sectionId = lineDetails?.sectionId || user?.selectedSection || null
  const customerId = lineDetails?.customerId || user?.selectedCustomer || null

  // Fetch line details
  useEffect(() => {
    const fetchLineDetails = async () => {
      try {
        // Use authFetch to include user ID header
        const response = await authFetch(`/api/master-data/lines/${lineId}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          setLineDetails(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch line details:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (lineId) {
      fetchLineDetails()
    }
  }, [lineId])

  // Set active line for operators when entering
  useEffect(() => {
    if (isOperator && lineId && !activeLineId) {
      setActiveLine(lineId, lineName)
    }
  }, [isOperator, lineId, lineName, activeLineId, setActiveLine])

  // Loading state
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-3">LOADING...</h2>
          <p className="text-sm font-mono text-text-tertiary">
            {loading ? 'Loading line data' : 'Verifying credentials'}
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
    <LiveViewV3
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

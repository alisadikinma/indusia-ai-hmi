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
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/hooks/useI18n'
import { authFetch } from '@/lib/utils/authFetch'
import { LiveViewV3 } from '@/components/inspection/LiveViewV3'
import PageLoading from '@/components/common/PageLoading'

export default function LiveInspectionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lineId } = params
  const modelName = searchParams.get('model') || null
  const { user, isOperator, setActiveLine, clearActiveLine, activeLineId, hasMenuAccess } = useAuth()
  const { t } = useI18n()
  
  // State for line details
  const [lineDetails, setLineDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  // Get line details from user context or master data
  const lineName = lineDetails?.name || `Line ${lineId}`
  const sectionId = lineDetails?.sectionId || lineDetails?.section_id || user?.selectedSection || null
  const customerId = lineDetails?.customerId || lineDetails?.customer_id || user?.selectedCustomer || null
  const customerName = lineDetails?.customer?.name || lineDetails?.customerName || null
  const customerLogo = lineDetails?.customer?.logoBase64 || lineDetails?.customerLogo || null

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

  // Set active line for operators on initial page entry only.
  // Must NOT re-run when activeLineId changes — otherwise clearActiveLine()
  // (used when WO completes) triggers re-activation before navigation completes.
  useEffect(() => {
    if (isOperator && lineId) {
      setActiveLine(lineId, lineName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Loading state
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <PageLoading message={loading ? t('inspection.loadingLineData') : t('auth.verifyingCredentials')} />
      </div>
    )
  }

  // Check access via database permissions
  if (!hasMenuAccess('menu_inspection')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <h2 className="text-xl font-display font-bold text-phosphor-red mb-3">{t('auth.accessDenied')}</h2>
          <p className="text-sm font-mono text-text-tertiary">
            {t('inspection.noPermissionLive')}
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
      customerName={customerName}
      customerLogo={customerLogo}
      modelName={modelName}
      user={user}
      onExit={handleExit}
      isOperator={isOperator}
    />
  )
}

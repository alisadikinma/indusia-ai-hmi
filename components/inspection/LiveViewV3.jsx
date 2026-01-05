/**
 * LiveView V3 - SSE-Based AOI Inspection Interface
 * 
 * Flow:
 * 1. Load active Work Order
 * 2. Connect to AI Backend SSE
 * 3. Display loading during capture/processing (running_status events)
 * 4. Display dual-side images when inspection arrives (inspection event)
 * 5. Operator clicks GOOD or NG
 * 6. POST /confirm → PLC action
 * 7. Reset and wait for next board
 * 
 * Button Logic (GOOD/NG Workflow):
 * - GOOD button: Pass the board
 *   - If AI says PASS: Confirm AI is correct → good_qty++
 *   - If AI says FAIL: Override AI (false call) → board passes, false_call_qty++
 * - NG button: Reject the board
 *   - If AI says FAIL: Confirm AI is correct → ng_qty++
 *   - If AI says PASS: Override AI (missed defect) → board rejected, false_call_qty++
 * 
 * False Call Auto-Detection:
 * - is_false_call = true when operator disagrees with AI
 * - (AI PASS + Operator NG) OR (AI FAIL + Operator GOOD)
 * 
 * Auto-NG Feature:
 * - Toggle ON: Auto-confirm NG after 15s timeout
 * - Toggle OFF: Operator must manually confirm
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Wifi, WifiOff, Clock, User, Package, Pause, Play,
  CheckCircle2, XCircle, AlertTriangle, AlertCircle,
  Square, FlaskConical, Menu, LogOut, ChevronDown,
  Layers, RefreshCw, Settings, Camera, Cpu, RotateCcw,
  Loader2, Activity, CircleDot, FileText, ToggleLeft, ToggleRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useAuth } from '@/context/AuthContext'
import { useActiveWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders'
import { useLiveInspection } from '@/hooks/useLiveInspection'
import { useAudioFeedback } from '@/hooks/useAudioFeedback'

// Components
import { InspectionStage } from './InspectionStage'
import { InspectionResult } from './InspectionResult'
import { FalseCallModal } from './FalseCallModal'
import { VolumeControl } from './VolumeControl'

// Services
import { saveInspection } from '@/lib/services/inspectionService'
import { getInspectionResult } from '@/lib/services/imageService'

// Constants
const NG_REVIEW_TIMEOUT_SECONDS = 15 // Timeout for NG review → auto NG
const PASS_DISPLAY_DELAY_MS = 2000 // Display PASS result for 2 seconds before auto-proceed
const DEV_MODE = process.env.NODE_ENV === 'development'
const BYPASS_WO_CHECK = true // TEMPORARY: Bypass WO check for testing
const BYPASS_OPERATOR_CHECK = true // TEMPORARY: Bypass operator role check for testing
const AUTO_NG_STORAGE_KEY = 'indusia_auto_ng_enabled' // localStorage key for Auto-NG toggle

// Mock WO for testing when Supabase not configured
const MOCK_WORK_ORDER = {
  id: 'mock-wo-001',
  woNumber: 'WO-DEV-001',
  lotSize: 100,
  completedQty: 0,
  goodQty: 0,
  ngQty: 0,
  falseCallQty: 0,
  status: 'active',
}

export function LiveViewV3({
  lineId,
  lineName,
  sectionId,
  customerId,
  user,
  onExit,
  isOperator = false,
}) {
  const router = useRouter()
  const { showSidebar } = useSidebar()
  const { logout } = useAuth()
  
  // Work Order hooks
  const { workOrder: fetchedWO, hasActiveWO: fetchedHasWO, loading: woLoading, refresh: refreshWO } = useActiveWorkOrder(lineId)
  const { updateCounters } = useWorkOrderMutations()

  // Use mock WO if bypass enabled and no real WO
  const workOrder = (BYPASS_WO_CHECK && !fetchedWO) ? MOCK_WORK_ORDER : fetchedWO
  const hasActiveWO = BYPASS_WO_CHECK || fetchedHasWO

  // Live Inspection hook (SSE connection)
  const {
    isConnected,
    isReconnecting,
    connectionError,
    aiBackendAvailable,
    hardwareStatus,
    stageDefinitions,
    inspectionStage,
    currentInspection,
    sessionStatus,
    processStatus,
    isControlling,
    isConfirming,
    lastConfirmation,
    confirmInspection,
    connect,
    disconnect,
    reconnect,
    checkAiBackend,
    runProcess,
    pauseProcess,
    stopProcess
  } = useLiveInspection(lineId, workOrder, {
    autoConnect: true,
    onError: (err) => console.error('[LiveView] SSE Error:', err)
  })

  // Audio feedback hook
  const { 
    volume, 
    isMuted, 
    announceResult, 
    setVolume, 
    toggleMute, 
    testAudio 
  } = useAudioFeedback()

  // UI State
  const [isPaused, setIsPaused] = useState(false)
  const [showFalseCallModal, setShowFalseCallModal] = useState(false)
  const [pendingDecision, setPendingDecision] = useState(null) // 'GOOD' or 'NG'
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)
  
  // Auto-NG toggle state (persisted to localStorage)
  const [autoNgEnabled, setAutoNgEnabled] = useState(true)
  
  // Load Auto-NG preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTO_NG_STORAGE_KEY)
    if (stored !== null) {
      setAutoNgEnabled(stored === 'true')
    }
  }, [])
  
  // Save Auto-NG preference to localStorage when changed
  const toggleAutoNg = useCallback(() => {
    setAutoNgEnabled(prev => {
      const newValue = !prev
      localStorage.setItem(AUTO_NG_STORAGE_KEY, String(newValue))
      return newValue
    })
  }, [])
  
  // Timer states for NG review timeout
  const [reviewCountdown, setReviewCountdown] = useState(NG_REVIEW_TIMEOUT_SECONDS)
  const reviewTimerRef = useRef(null)
  
  // Track if current inspection has been processed (prevent double submit)
  const processedInspectionRef = useRef(null)

  // Board sequence (for local tracking)
  const boardSequenceRef = useRef(workOrder?.completedQty || 0)

  // Dev mode: Mock inspection state
  const [devMockInspection, setDevMockInspection] = useState(null)
  const [devMockStage, setDevMockStage] = useState({
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 3,
    icon: 'hourglass'
  })

  // Real-time clock
  const [currentTime, setCurrentTime] = useState('')
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  // Calculate yield from WO data
  const yieldPercent = workOrder?.completedQty > 0 
    ? ((workOrder.goodQty / workOrder.completedQty) * 100).toFixed(1) 
    : '0.0'

  // Determine active inspection data (real SSE or dev mock)
  const activeInspection = currentInspection || devMockInspection
  
  // Determine active stage - use SSE inspectionStage when connected, devMockStage for simulation
  const activeStage = isConnected ? inspectionStage : devMockStage

  // Determine AI result for UI
  const aiResult = activeInspection?.decision === 'PASS' ? 'GOOD' : 
                   activeInspection?.decision === 'FAIL' ? 'NG' : 'WAITING'

  // ============================================
  // Action Handlers
  // ============================================

  /**
   * Submit decision to AI Backend
   * (Defined first as other handlers depend on it)
   */
  const submitDecision = useCallback(async (operatorDecision, falseCallData = null) => {
    if (!activeInspection || !workOrder) return

    try {
      // 1. Send to AI Backend (triggers PLC)
      if (currentInspection) {
        const result = await confirmInspection(operatorDecision, {
          falseCallReason: falseCallData?.reason,
          comment: falseCallData?.notes
        })
        if (!result.success) {
          console.error('[LiveView] Confirm failed:', result.error)
          // Continue anyway for local updates
        }
      }

      // 2. Calculate false call
      const isFalseCall = (activeInspection.decision === 'PASS' && operatorDecision === 'NG') ||
                         (activeInspection.decision === 'FAIL' && operatorDecision === 'GOOD')

      // 2.5. If false call: save images locally + create Override for Manager review
      if (isFalseCall && activeInspection.results) {
        try {
          const boardId = `${workOrder.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`
          const overrideType = activeInspection.decision === 'PASS' ? 'MISSED_DEFECT' : 'FALSE_POSITIVE'
          
          // Step 1: Save images to LOCAL storage
          const uploadResponse = await fetch('/api/inspection/upload-false-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inspection: activeInspection,
              workOrder,
              customerName: workOrder?.customer?.name || workOrder?.customerName || 'UNKNOWN',
              boardSequence: String(boardSequenceRef.current + 1).padStart(4, '0'),
              falseCallReason: falseCallData?.reason || 'UNSPECIFIED'
            })
          })
          
          const uploadResult = await uploadResponse.json()
          const localPaths = uploadResult.success ? uploadResult.paths : {}
          
          if (uploadResult.success) {
            console.log('[LiveView] ✅ False call images saved locally:', localPaths)
          } else {
            console.warn('[LiveView] ⚠️ Local save failed:', uploadResult.error)
          }
          
          // Step 2: Create Override record for Manager review
          const overrideResponse = await fetch('/api/overrides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              board_id: boardId,
              section_id: sectionId,
              line_id: lineId,
              customer_id: customerId,
              override_type: overrideType,
              defect_type: overrideType, // Required by schema
              reason: falseCallData?.reason || 'UNSPECIFIED',
              operator_notes: falseCallData?.notes || '',
              operator_id: user?.id,
              operator_name: user?.name,
              // Local paths for sync later
              image_url: localPaths?.top?.[0] || '',
            })
          })
          
          const overrideResult = await overrideResponse.json()
          
          if (overrideResult.success) {
            console.log('[LiveView] ✅ Override created for Manager review:', overrideResult.data?.id)
          } else {
            console.warn('[LiveView] ⚠️ Override creation failed:', overrideResult.error)
          }
        } catch (err) {
          console.warn('[LiveView] ⚠️ False call process error:', err)
        }
      }

      // 3. Save to database (skip if mock WO)
      if (!BYPASS_WO_CHECK || fetchedWO) {
        const inspectionData = {
          boardId: `${workOrder.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`,
          workOrderId: workOrder.id,
          lineId,
          sectionId,
          customerId,
          boardSequence: boardSequenceRef.current + 1,
          aiResult: activeInspection.decision === 'PASS' ? 'GOOD' : 'NG',
          aiConfidence: calculateAvgConfidence(activeInspection),
          operatorDecision,
          operatorId: user?.id,
          isFalseCall,
          falseCallReasonCode: falseCallData?.reason,
          plcSignalSent: operatorDecision,
          shift: getCurrentShift(),
          defectCount: getTotalDefects(activeInspection),
          imageTopUrl: activeInspection.results?.top?.image_url,
          imageBottomUrl: activeInspection.results?.bottom?.image_url,
        }

        try {
          await saveInspection(inspectionData)
        } catch (dbError) {
          console.warn('[LiveView] Save inspection failed (Supabase not configured?):', dbError)
        }

        // 4. Update WO counters
        const counterUpdate = operatorDecision === 'GOOD' 
          ? { goodQty: 1, completedQty: 1 }
          : { ngQty: 1, completedQty: 1 }
        
        if (isFalseCall) {
          counterUpdate.falseCallQty = 1
        }
        
        try {
          await updateCounters(workOrder.id, counterUpdate)
        } catch (dbError) {
          console.warn('[LiveView] Update counters failed (Supabase not configured?):', dbError)
        }
        
        // 6. Refresh WO data
        refreshWO()
      } else {
        console.log('[LiveView] Skipping DB operations (BYPASS_WO_CHECK enabled)')
      }
      
      // 5. Update local sequence
      boardSequenceRef.current += 1

      // 7. Reset dev mock if used
      if (devMockInspection) {
        setDevMockInspection(null)
        setDevMockStage({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
          totalStages: 3,
          icon: 'hourglass'
        })
      }

      console.log('[LiveView] Decision submitted:', { operatorDecision, isFalseCall })

    } catch (error) {
      console.error('[LiveView] Submit decision error:', error)
    }
  }, [activeInspection, workOrder, fetchedWO, currentInspection, confirmInspection, 
      lineId, sectionId, customerId, user, updateCounters, refreshWO, devMockInspection])

  /**
   * Handle GOOD button click
   * - If AI says PASS: Confirm (agree with AI)
   * - If AI says FAIL: False call (disagree with AI)
   */
  const handleGoodClick = useCallback(async () => {
    if (!isOperator || !activeInspection || isConfirming) return
    
    // Clear review timer
    if (reviewTimerRef.current) clearInterval(reviewTimerRef.current)
    
    // Mark as processed
    const inspectionId = activeInspection.inspection_id || activeInspection.inspectionId
    processedInspectionRef.current = inspectionId
    
    const isFalseCall = activeInspection.decision === 'FAIL'
    
    if (isFalseCall) {
      // AI said FAIL but operator says GOOD → show false call modal
      setPendingDecision('GOOD')
      setShowFalseCallModal(true)
    } else {
      // AI said PASS, operator confirms → direct confirm
      await submitDecision('GOOD')
    }
  }, [isOperator, activeInspection, isConfirming, submitDecision])

  /**
   * Handle NG button click
   * - If AI says FAIL: Confirm (agree with AI)
   * - If AI says PASS: Missed defect (disagree with AI)
   */
  const handleNGClick = useCallback(async () => {
    if (!isOperator || !activeInspection || isConfirming) return
    
    // Clear review timer
    if (reviewTimerRef.current) clearInterval(reviewTimerRef.current)
    
    // Mark as processed
    const inspectionId = activeInspection.inspection_id || activeInspection.inspectionId
    processedInspectionRef.current = inspectionId
    
    const isMissedDefect = activeInspection.decision === 'PASS'
    
    if (isMissedDefect) {
      // AI said PASS but operator says NG → show false call modal
      setPendingDecision('NG')
      setShowFalseCallModal(true)
    } else {
      // AI said FAIL, operator confirms → direct confirm
      await submitDecision('NG')
    }
  }, [isOperator, activeInspection, isConfirming, submitDecision])

  /**
   * Handle false call modal submit
   */
  const handleFalseCallSubmit = useCallback(async (formData) => {
    setShowFalseCallModal(false)
    await submitDecision(pendingDecision, formData)
    setPendingDecision(null)
  }, [pendingDecision, submitDecision])

  // ============================================
  // Auto-proceed logic:
  // - AI GOOD (PASS): auto proceed immediately
  // - AI NG (FAIL): 15s timeout for review → auto NG
  // ============================================
  
  // Audio announcement when inspection result arrives
  useEffect(() => {
    if (!activeInspection || !isOperator) return
    
    // Check if already processed this inspection
    const inspectionId = activeInspection.inspection_id || activeInspection.inspectionId
    if (processedInspectionRef.current === inspectionId) return
    
    // Announce result via voice
    announceResult(aiResult)
  }, [activeInspection, aiResult, isOperator, announceResult])
  
  useEffect(() => {
    // Clear timer when no inspection or paused
    if (!activeInspection || !isOperator || isPaused) {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current)
      return
    }

    // Check if already processed this inspection
    const inspectionId = activeInspection.inspection_id || activeInspection.inspectionId
    if (processedInspectionRef.current === inspectionId) {
      return // Already processed
    }

    if (aiResult === 'GOOD') {
      // AI says PASS → delay to show result, then auto proceed
      const timeoutId = setTimeout(() => {
        processedInspectionRef.current = inspectionId
        submitDecision('GOOD')
      }, PASS_DISPLAY_DELAY_MS)
      
      return () => clearTimeout(timeoutId)
    } else if (aiResult === 'NG') {
      // AI says FAIL → start review countdown ONLY if Auto-NG is enabled
      if (autoNgEnabled) {
        setReviewCountdown(NG_REVIEW_TIMEOUT_SECONDS)
        
        reviewTimerRef.current = setInterval(() => {
          setReviewCountdown(prev => {
            if (prev <= 1) {
              // Timeout → auto confirm NG
              processedInspectionRef.current = inspectionId
              submitDecision('NG') // Direct call instead of handleNGClick to avoid modal
              return NG_REVIEW_TIMEOUT_SECONDS
            }
            return prev - 1
          })
        }, 1000)
      } else {
        // Auto-NG disabled → just reset countdown display (no timer)
        setReviewCountdown(NG_REVIEW_TIMEOUT_SECONDS)
      }
    }

    return () => {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current)
    }
  }, [aiResult, isPaused, isOperator, activeInspection, submitDecision, autoNgEnabled])

  // ============================================
  // Dev Mode: Simulate Inspection
  // ============================================

  const simulateInspection = useCallback(async (result) => {
    if (!workOrder || activeInspection) return

    // Simulate stages (matches dev.py: start, running, done)
    const stages = ['start', 'running', 'done']
    
    for (const stage of stages) {
      setDevMockStage({
        status: stage === 'done' ? 'ready' : stage === 'running' ? 'processing' : 'capturing',
        stageName: stage,
        message: getStageMessage(stage),
        stageIndex: stages.indexOf(stage) + 1,
        totalStages: 3,
        icon: getStageIcon(stage)
      })
      await new Promise(r => setTimeout(r, 300)) // Fast simulation
    }

    // Get mock images
    const topResult = await getInspectionResult({ side: 'TOP', result })
    const bottomResult = await getInspectionResult({ side: 'BOTTOM', result })

    // Create mock inspection
    const mockInspection = {
      inspectionId: `mock-${Date.now()}`,
      modelName: 'YOLOv8-AOI-Mock',
      results: {
        top: topResult ? {
          image_url: topResult.imageUrl,
          objects: (topResult.defects || []).map(d => ({
            name: d.class_name,
            box: d.bbox ? [d.bbox.x, d.bbox.y, d.bbox.x + d.bbox.width, d.bbox.y + d.bbox.height] : [0, 0, 100, 100],
            score: d.confidence,
            side: 'TOP'
          }))
        } : null,
        bottom: bottomResult ? {
          image_url: bottomResult.imageUrl,
          objects: (bottomResult.defects || []).map(d => ({
            name: d.class_name,
            box: d.bbox ? [d.bbox.x, d.bbox.y, d.bbox.x + d.bbox.width, d.bbox.y + d.bbox.height] : [0, 0, 100, 100],
            score: d.confidence,
            side: 'BOTTOM'
          }))
        } : null
      },
      decision: result === 'GOOD' ? 'PASS' : 'FAIL',
      timestamp: new Date().toISOString()
    }

    setDevMockInspection(mockInspection)
  }, [workOrder, activeInspection])

  // ============================================
  // Keyboard Shortcuts
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFalseCallModal) return
      if (!workOrder) return

      const key = e.key.toLowerCase()

      // Dev mode simulation (only when no active inspection)
      if (DEV_MODE && !activeInspection && !aiBackendAvailable) {
        if (key === 's') {
          simulateInspection('GOOD')
          return
        }
        if (key === 'd') {
          simulateInspection('NG')
          return
        }
      }

      if (!isOperator || isConfirming || !activeInspection) return

      switch (key) {
        case 'g':
          handleGoodClick()
          break
        case 'n':
          handleNGClick()
          break
        case ' ':
          e.preventDefault()
          setIsPaused(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOperator, isConfirming, showFalseCallModal, activeInspection, workOrder,
      handleGoodClick, handleNGClick, aiBackendAvailable, simulateInspection])

  // ============================================
  // Helper Functions
  // ============================================

  const calculateAvgConfidence = (inspection) => {
    // Handle array of frames structure
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    
    const allObjects = [
      ...topFrames.flatMap(f => f.objects || []),
      ...bottomFrames.flatMap(f => f.objects || [])
    ]
    if (allObjects.length === 0) return 1.0
    return allObjects.reduce((sum, obj) => sum + obj.score, 0) / allObjects.length
  }

  const getTotalDefects = (inspection) => {
    // Handle array of frames structure
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    
    const topCount = topFrames.reduce((sum, f) => sum + (f.objects?.length || 0), 0)
    const bottomCount = bottomFrames.reduce((sum, f) => sum + (f.objects?.length || 0), 0)
    return topCount + bottomCount
  }

  const getCurrentShift = () => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 14) return 'day'
    if (hour >= 14 && hour < 22) return 'swing'
    return 'night'
  }

  const getStageMessage = (stage) => {
    const messages = {
      'start': 'Board incoming...',
      'running': 'Processing...',
      'done': 'Ready for review'
    }
    return messages[stage] || 'Processing...'
  }

  const getStageIcon = (stage) => {
    if (stage === 'start') return 'loader'
    if (stage === 'running') return 'cpu'
    if (stage === 'done') return 'check'
    return 'loader'
  }

  // ============================================
  // No Active WO State
  // ============================================

  if (!woLoading && !hasActiveWO) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-void p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-phosphor-amber mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            No Active Work Order
          </h1>
          <p className="text-text-secondary mb-6">
            There is no active work order assigned to this line. 
            Please contact Engineering to assign a work order.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onExit}
              className="px-6 py-3 bg-phosphor-red text-void font-display font-bold tracking-wider hover:shadow-glow-red transition-all"
            >
              BACK
            </button>
            <button
              onClick={refreshWO}
              className="px-6 py-3 border border-phosphor-amber text-phosphor-amber font-display font-bold tracking-wider hover:bg-phosphor-amber/10 transition-all"
            >
              REFRESH
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Actions disabled? Only enable when AI says FAIL (NG)
  const actionsDisabled = !isOperator || isConfirming || isPaused || !activeInspection || aiResult !== 'NG'

  // ============================================
  // Render
  // ============================================

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* ============ HEADER ============ */}
      <header className="h-14 flex-shrink-0 bg-panel border-b border-surface-border flex items-center justify-between px-4">
        {/* Left: Menu + Logo + Line Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={showSidebar}
            className="p-2 border border-surface-border text-text-secondary hover:border-phosphor-amber/50 hover:text-phosphor-amber transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-phosphor-amber flex items-center justify-center bg-terminal">
              <span className="font-display font-bold text-lg text-phosphor-amber">IN</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-wider text-text-primary">
                {lineName || `Line ${lineId}`}
              </h1>
              <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
                LIVE INSPECTION
              </p>
            </div>
          </div>

        </div>

        {/* Center: Board ID only */}
        <div className="flex items-center gap-4">
          {/* Work Order */}
          <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
            <FileText className="w-4 h-4 text-text-tertiary" />
            <div>
              <p className="font-mono text-xxs text-text-tertiary">WORK ORDER</p>
              <p className="font-mono text-sm font-bold text-phosphor-cyan">
                {workOrder?.woNumber || '---'}
              </p>
            </div>
          </div>

          {/* Board ID - show when WO selected (persist through pause/stop) */}
          <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
            <Package className="w-4 h-4 text-text-tertiary" />
            <div>
              <p className="font-mono text-xxs text-text-tertiary">BOARD</p>
              <p className="font-mono text-sm font-bold text-text-primary">
                {workOrder?.woNumber
                  ? `${workOrder.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`
                  : '---'
                }
              </p>
            </div>
          </div>

          {/* Auto-NG Toggle + Countdown */}
          <div className="flex items-center gap-3">
            {/* Auto-NG Toggle */}
            <button
              onClick={toggleAutoNg}
              className={cn(
                "flex items-center gap-2 px-3 py-2 border transition-all",
                autoNgEnabled 
                  ? "border-phosphor-amber bg-phosphor-amber/10" 
                  : "border-surface-border bg-terminal hover:border-text-tertiary"
              )}
              title={autoNgEnabled ? "Auto-NG ON: Will auto-reject after 15s" : "Auto-NG OFF: Manual confirmation required"}
            >
              {autoNgEnabled ? (
                <ToggleRight className="w-5 h-5 text-phosphor-amber" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-text-tertiary" />
              )}
              <span className={cn(
                "font-mono text-xs font-bold",
                autoNgEnabled ? "text-phosphor-amber" : "text-text-tertiary"
              )}>
                AUTO-NG
              </span>
            </button>

            {/* NG Review Countdown - only show when AI FAIL and Auto-NG is ON */}
            {aiResult === 'NG' && activeInspection && autoNgEnabled && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 border",
                reviewCountdown <= 5 
                  ? "bg-phosphor-red/20 border-phosphor-red animate-pulse" 
                  : "bg-phosphor-amber/10 border-phosphor-amber/50"
              )}>
                <span className={cn(
                  "font-mono text-sm",
                  reviewCountdown <= 5 ? "text-phosphor-red" : "text-phosphor-amber"
                )}>Auto NG in</span>
                <span className={cn(
                  "font-mono text-2xl font-bold",
                  reviewCountdown <= 5 ? "text-phosphor-red" : "text-phosphor-amber"
                )}>
                  {reviewCountdown}s
                </span>
              </div>
            )}

            {/* Manual Mode Indicator - show when Auto-NG is OFF and NG detected */}
            {aiResult === 'NG' && activeInspection && !autoNgEnabled && (
              <div className="flex items-center gap-2 px-3 py-2 border border-phosphor-cyan bg-phosphor-cyan/10">
                <span className="font-mono text-sm text-phosphor-cyan">MANUAL MODE</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: User + Time */}
        <div className="flex items-center gap-4">
          {!isOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 border border-phosphor-cyan/30">
              <span className="font-mono text-xs font-bold text-phosphor-cyan">VIEW ONLY</span>
            </div>
          )}

          {/* Volume Control */}
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={setVolume}
            onMuteToggle={toggleMute}
            onTest={testAudio}
          />

          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 bg-terminal border transition-colors",
                showUserMenu 
                  ? "border-phosphor-cyan" 
                  : "border-surface-border hover:border-text-tertiary"
              )}
            >
              <User className="w-4 h-4 text-text-tertiary" />
              <span className="font-mono text-xs text-text-primary">{user?.name || 'Unknown'}</span>
              <ChevronDown className={cn(
                "w-3 h-3 text-text-tertiary transition-transform",
                showUserMenu && "rotate-180"
              )} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-panel border border-surface-border shadow-lg z-50">
                <div className="px-3 py-2 border-b border-surface-border">
                  <p className="font-mono text-xs text-text-primary">{user?.name}</p>
                  <p className="font-mono text-xxs text-text-tertiary capitalize">{user?.role || 'User'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    logout()
                    router.push('/login')
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-phosphor-red/10 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-phosphor-red" />
                  <span className="font-mono text-xs text-phosphor-red">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============ HARDWARE & MACHINE STATUS BAR ============ */}
      <div className="h-14 flex-shrink-0 bg-terminal border-b border-surface-border flex items-center justify-between px-4">
        {/* Left: Machine Control Buttons */}
        <div className="flex items-center gap-3">
          {/* RUN Button */}
          <button
            onClick={runProcess}
            disabled={!isConnected || isControlling || processStatus === 'RUNNING'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              processStatus === 'RUNNING'
                ? "bg-phosphor-green border-phosphor-green text-void"
                : isConnected && processStatus !== 'RUNNING'
                  ? "border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Play className="w-4 h-4" />
            <span>RUN</span>
          </button>

          {/* PAUSE Button */}
          <button
            onClick={pauseProcess}
            disabled={!isConnected || isControlling || processStatus !== 'RUNNING'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              processStatus === 'PAUSED'
                ? "bg-phosphor-amber border-phosphor-amber text-void"
                : isConnected && processStatus === 'RUNNING'
                  ? "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Pause className="w-4 h-4" />
            <span>PAUSE</span>
          </button>

          {/* STOP Button */}
          <button
            onClick={stopProcess}
            disabled={!isConnected || isControlling || processStatus === 'IDLE' || processStatus === 'STOPPED'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              processStatus === 'STOPPED'
                ? "bg-phosphor-red border-phosphor-red text-void"
                : isConnected && processStatus !== 'IDLE' && processStatus !== 'STOPPED'
                  ? "border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Square className="w-4 h-4" />
            <span>STOP</span>
          </button>
        </div>

        {/* Center: Inspection Stage */}
        <div className="flex items-center gap-4">
          {/* Current Stage Detail */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            activeStage.status === 'idle' && "border-surface-border bg-surface-border/10",
            activeStage.status === 'capturing' && "border-phosphor-cyan bg-phosphor-cyan/10",
            activeStage.status === 'processing' && "border-phosphor-amber bg-phosphor-amber/10",
            activeStage.status === 'ready' && "border-phosphor-green bg-phosphor-green/10"
          )}>
            {activeStage.status === 'idle' && <CircleDot className="w-4 h-4 text-text-tertiary" />}
            {activeStage.status === 'capturing' && <Camera className="w-4 h-4 text-phosphor-cyan animate-pulse" />}
            {activeStage.status === 'processing' && <Cpu className="w-4 h-4 text-phosphor-amber animate-pulse" />}
            {activeStage.status === 'ready' && <CheckCircle2 className="w-4 h-4 text-phosphor-green" />}
            
            {activeStage.stageName?.includes('top') && (
              <span className="font-mono text-xs font-bold text-phosphor-cyan">TOP</span>
            )}
            {activeStage.stageName?.includes('bottom') && (
              <span className="font-mono text-xs font-bold text-phosphor-magenta">BOTTOM</span>
            )}
            {activeStage.stageName === 'pcb_flipping' && (
              <RotateCcw className="w-4 h-4 text-phosphor-amber animate-spin" />
            )}
            <span className="font-mono text-xs text-text-secondary">
              {activeStage.message}
            </span>
          </div>

          {/* Stage Progress Dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: activeStage.totalStages }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i < activeStage.stageIndex ? "bg-phosphor-green" :
                  i === activeStage.stageIndex ? "bg-phosphor-amber animate-pulse" :
                  "bg-surface-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Right: Hardware Status */}
        <div className="flex items-center gap-3">
          {/* Camera Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            hardwareStatus.cameras?.[0]?.status === 'ONLINE' 
              ? "border-phosphor-green/50 bg-phosphor-green/5" 
              : hardwareStatus.cameras?.length > 0
                ? "border-phosphor-red/50 bg-phosphor-red/5"
                : "border-surface-border bg-surface-border/10"
          )}>
            <Camera className={cn(
              "w-4 h-4",
              hardwareStatus.cameras?.[0]?.status === 'ONLINE' 
                ? "text-phosphor-green" 
                : hardwareStatus.cameras?.length > 0
                  ? "text-phosphor-red"
                  : "text-text-tertiary"
            )} />
            <span className="font-mono text-xs text-text-secondary">CAM</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              hardwareStatus.cameras?.[0]?.status === 'ONLINE' 
                ? "bg-phosphor-green" 
                : hardwareStatus.cameras?.length > 0
                  ? "bg-phosphor-red animate-pulse"
                  : "bg-surface-border"
            )} />
          </div>

          {/* PLC Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            hardwareStatus.plcs?.[0]?.status === 'ONLINE' 
              ? "border-phosphor-green/50 bg-phosphor-green/5" 
              : hardwareStatus.plcs?.length > 0
                ? "border-phosphor-red/50 bg-phosphor-red/5"
                : "border-surface-border bg-surface-border/10"
          )}>
            <Activity className={cn(
              "w-4 h-4",
              hardwareStatus.plcs?.[0]?.status === 'ONLINE' 
                ? "text-phosphor-green" 
                : hardwareStatus.plcs?.length > 0
                  ? "text-phosphor-red"
                  : "text-text-tertiary"
            )} />
            <span className="font-mono text-xs text-text-secondary">PLC</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              hardwareStatus.plcs?.[0]?.status === 'ONLINE' 
                ? "bg-phosphor-green" 
                : hardwareStatus.plcs?.length > 0
                  ? "bg-phosphor-red animate-pulse"
                  : "bg-surface-border"
            )} />
          </div>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-3">
          {activeInspection ? (
            /* Inspection Result - Dual Side View */
            <InspectionResult
              inspection={activeInspection}
              className="flex-1"
            />
          ) : (
            /* Inspection Stage Progress */
            <InspectionStage
              stage={activeStage}
              stageDefinitions={stageDefinitions}
              processStatus={processStatus}
              onResume={runProcess}
              className="flex-1 bg-panel rounded-lg border border-surface-border"
            />
          )}
        </div>
      </main>

      {/* ============ FOOTER: ACTIONS ============ */}
      <footer className="h-28 flex-shrink-0 bg-panel border-t border-surface-border flex items-center justify-between px-4">
        {/* Left: WO Stats */}
        <div className="flex items-center gap-4">
          {workOrder && (
            <div className="flex items-center gap-6 px-4 py-2 bg-terminal border border-surface-border">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-tertiary">PROGRESS</span>
                <span className="font-mono text-xl font-bold text-phosphor-amber">
                  {workOrder.completedQty}/{workOrder.lotSize}
                </span>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-phosphor-green" />
                <span className="font-mono text-xl font-bold text-phosphor-green">{workOrder.goodQty}</span>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-phosphor-red" />
                <span className="font-mono text-xl font-bold text-phosphor-red">{workOrder.ngQty}</span>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-tertiary">YIELD</span>
                <span className={cn(
                  "font-mono text-xl font-bold",
                  parseFloat(yieldPercent) >= 98 ? "text-phosphor-green" : 
                  parseFloat(yieldPercent) >= 95 ? "text-phosphor-amber" : "text-phosphor-red"
                )}>
                  {yieldPercent}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center gap-4">
          {/* Dev Mode Simulate Buttons */}
          {DEV_MODE && !activeInspection && !aiBackendAvailable && (
            <>
              <button
                onClick={() => simulateInspection('GOOD')}
                disabled={!workOrder}
                className={cn(
                  "h-14 px-5 flex items-center gap-2 border-2 transition-all",
                  "font-display text-sm font-bold tracking-wider",
                  "bg-phosphor-green/10 border-phosphor-green text-phosphor-green",
                  "hover:bg-phosphor-green hover:text-void",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <FlaskConical className="w-5 h-5" />
                <span>SIM PASS (S)</span>
              </button>
              <button
                onClick={() => simulateInspection('NG')}
                disabled={!workOrder}
                className={cn(
                  "h-14 px-5 flex items-center gap-2 border-2 transition-all",
                  "font-display text-sm font-bold tracking-wider",
                  "bg-phosphor-red/10 border-phosphor-red text-phosphor-red",
                  "hover:bg-phosphor-red hover:text-void",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <FlaskConical className="w-5 h-5" />
                <span>SIM FAIL (D)</span>
              </button>
            </>
          )}

          {/* GOOD Button - Large for glove operation (min 30mm) */}
          <button
            onClick={handleGoodClick}
            disabled={actionsDisabled}
            className={cn(
              "h-20 px-14 flex items-center gap-4 border-4 transition-all",
              "font-display text-2xl font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : "bg-phosphor-green/10 border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void hover:shadow-glow-green"
            )}
          >
            <CheckCircle2 className="w-8 h-8" />
            <span>GOOD</span>
            <span className="font-mono text-sm opacity-60">(G)</span>
          </button>

          {/* NG Button - Large for glove operation (min 30mm) */}
          <button
            onClick={handleNGClick}
            disabled={actionsDisabled}
            className={cn(
              "h-20 px-14 flex items-center gap-4 border-4 transition-all",
              "font-display text-2xl font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : "bg-phosphor-red/10 border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void hover:shadow-glow-red"
            )}
          >
            <XCircle className="w-8 h-8" />
            <span>NG</span>
            <span className="font-mono text-sm opacity-60">(N)</span>
          </button>
        </div>
      </footer>

      {/* ============ MODALS ============ */}
      
      {/* False Call Modal */}
      <FalseCallModal
        isOpen={showFalseCallModal}
        onClose={() => {
          setShowFalseCallModal(false)
          setPendingDecision(null)
        }}
        onSubmit={handleFalseCallSubmit}
        boardId={`${workOrder?.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`}
        defectType={activeInspection?.results?.top?.objects?.[0]?.name}
        aiResult={activeInspection?.decision === 'PASS' ? 'GOOD' : 'NG'}
        isProcessing={isConfirming}
        isMissedDefect={pendingDecision === 'NG'}
      />

      {/* Connection Error Banner */}
      {connectionError && !isConnected && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 px-6 py-3 bg-phosphor-red/20 border border-phosphor-red text-phosphor-red flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="font-mono text-sm">{connectionError}</span>
          <button
            onClick={reconnect}
            className="px-3 py-1 bg-phosphor-red text-void text-xs font-bold hover:bg-phosphor-red/80"
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  )
}

export default LiveViewV3

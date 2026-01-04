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
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Wifi, WifiOff, Clock, User, Package, Pause, Play,
  CheckCircle2, XCircle, AlertTriangle, AlertCircle,
  Volume2, VolumeX, Square, FlaskConical, Menu,
  Layers, RefreshCw, Settings, Camera, Cpu, RotateCcw,
  Loader2, Activity, CircleDot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useActiveWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders'
import { useLiveInspection } from '@/hooks/useLiveInspection'

// Components
import { InspectionStage } from './InspectionStage'
import { InspectionResult } from './InspectionResult'
import { FalseCallModal } from './FalseCallModal'

// Services
import { saveInspection } from '@/lib/services/inspectionService'
import { getInspectionResult } from '@/lib/services/imageService'

// Constants
const NG_REVIEW_TIMEOUT_SECONDS = 15 // Timeout for NG review → auto NG
const PASS_DISPLAY_DELAY_MS = 2000 // Display PASS result for 2 seconds before auto-proceed
const DEV_MODE = process.env.NODE_ENV === 'development'

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
  
  // Work Order hooks
  const { workOrder, hasActiveWO, loading: woLoading, refresh: refreshWO } = useActiveWorkOrder(lineId)
  const { updateCounters } = useWorkOrderMutations()

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

  // UI State
  const [isPaused, setIsPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showFalseCallModal, setShowFalseCallModal] = useState(false)
  const [pendingDecision, setPendingDecision] = useState(null) // 'GOOD' or 'NG'
  
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

      // 3. Save to database
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

      await saveInspection(inspectionData)

      // 4. Update WO counters
      const counterUpdate = operatorDecision === 'GOOD' 
        ? { goodQty: 1, completedQty: 1 }
        : { ngQty: 1, completedQty: 1 }
      
      if (isFalseCall) {
        counterUpdate.falseCallQty = 1
      }
      
      await updateCounters(workOrder.id, counterUpdate)
      
      // 5. Update local sequence
      boardSequenceRef.current += 1

      // 6. Refresh WO data
      refreshWO()

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
  }, [activeInspection, workOrder, currentInspection, confirmInspection, 
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
      // AI says FAIL → start review countdown
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
    }

    return () => {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current)
    }
  }, [aiResult, isPaused, isOperator, activeInspection, submitDecision])

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
              EXIT
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

          {/* Connection Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            isConnected 
              ? "border-phosphor-green/50 bg-phosphor-green/10" 
              : aiBackendAvailable === false
                ? "border-phosphor-amber/50 bg-phosphor-amber/10"
                : "border-phosphor-red/50 bg-phosphor-red/10"
          )}>
            {isConnected ? (
              <Wifi className="w-4 h-4 text-phosphor-green" />
            ) : isReconnecting ? (
              <RefreshCw className="w-4 h-4 text-phosphor-amber animate-spin" />
            ) : (
              <WifiOff className="w-4 h-4 text-phosphor-red" />
            )}
            <span className={cn(
              "font-mono text-xs font-bold",
              isConnected ? "text-phosphor-green" : 
              isReconnecting ? "text-phosphor-amber" : "text-phosphor-red"
            )}>
              {isConnected ? 'CONNECTED' : isReconnecting ? 'RECONNECTING' : 
               aiBackendAvailable === false ? 'DEV MODE' : 'DISCONNECTED'}
            </span>
          </div>

        </div>

        {/* Center: Board ID only */}
        <div className="flex items-center gap-4">
          {/* Board ID */}
          <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
            <Package className="w-4 h-4 text-text-tertiary" />
            <div>
              <p className="font-mono text-xxs text-text-tertiary">BOARD</p>
              <p className="font-mono text-sm font-bold text-text-primary">
                {activeInspection 
                  ? `${workOrder?.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`
                  : '---'
                }
              </p>
            </div>
          </div>

          {/* NG Review Countdown - only show when AI FAIL */}
          {aiResult === 'NG' && activeInspection && (
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
        </div>

        {/* Right: User + Time */}
        <div className="flex items-center gap-4">
          {!isOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 border border-phosphor-cyan/30">
              <span className="font-mono text-xs font-bold text-phosphor-cyan">VIEW ONLY</span>
            </div>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2 border transition-colors",
              soundEnabled
                ? "border-phosphor-amber text-phosphor-amber"
                : "border-surface-border text-text-tertiary"
            )}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>

          <div className="flex items-center gap-2 px-3 py-2 bg-terminal border border-surface-border">
            <User className="w-4 h-4 text-text-tertiary" />
            <span className="font-mono text-xs text-text-primary">{user?.name || 'Unknown'}</span>
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

          {/* Machine Status Badge */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border ml-2",
            processStatus === 'IDLE' && "border-surface-border bg-surface-border/10",
            processStatus === 'READY' && "border-phosphor-cyan bg-phosphor-cyan/10",
            processStatus === 'RUNNING' && "border-phosphor-green bg-phosphor-green/10",
            processStatus === 'PAUSED' && "border-phosphor-amber bg-phosphor-amber/10",
            processStatus === 'STOPPED' && "border-phosphor-red bg-phosphor-red/10"
          )}>
            {processStatus === 'RUNNING' && <Loader2 className="w-4 h-4 text-phosphor-green animate-spin" />}
            {processStatus === 'PAUSED' && <Pause className="w-4 h-4 text-phosphor-amber" />}
            {(processStatus === 'IDLE' || processStatus === 'STOPPED') && <CircleDot className="w-4 h-4 text-text-tertiary" />}
            {processStatus === 'READY' && <CheckCircle2 className="w-4 h-4 text-phosphor-cyan" />}
            <span className={cn(
              "font-mono text-xs font-bold",
              processStatus === 'IDLE' && "text-text-tertiary",
              processStatus === 'READY' && "text-phosphor-cyan",
              processStatus === 'RUNNING' && "text-phosphor-green",
              processStatus === 'PAUSED' && "text-phosphor-amber",
              processStatus === 'STOPPED' && "text-phosphor-red"
            )}>
              {processStatus}
            </span>
          </div>
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

        {/* Right: Exit Button Only */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className={cn(
              "h-12 px-6 flex items-center gap-2 transition-colors",
              "font-display text-sm font-bold tracking-wider",
              "border border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void"
            )}
          >
            <Square className="w-4 h-4" />
            <span>EXIT</span>
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

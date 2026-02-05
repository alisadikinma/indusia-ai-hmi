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
  Loader2, Activity, CircleDot, FileText, ToggleLeft, ToggleRight,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useActiveWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders'
import { useLiveInspection } from '@/hooks/useLiveInspection'
import { useAudioFeedback } from '@/hooks/useAudioFeedback'

// Components
import { InspectionStage } from './InspectionStage'
import { InspectionResult } from './InspectionResult'
import { FalseCallModal } from './FalseCallModal'
import { VolumeControl } from './VolumeControl'
import { HeaderInfoBar } from './HeaderInfoBar'

// Services
import { saveInspection } from '@/lib/services/inspectionService'
import { getInspectionResult } from '@/lib/services/imageService'
import { authFetch } from '@/lib/utils/authFetch'

// Constants
const NG_REVIEW_TIMEOUT_SECONDS = 15 // Timeout for NG review → auto NG
const PASS_DISPLAY_DELAY_MS = 2000 // Display PASS result for 2 seconds before auto-proceed
const DEV_MODE = process.env.NODE_ENV === 'development'
const BYPASS_WO_CHECK = true // TEMPORARY: Bypass WO check for testing
const BYPASS_OPERATOR_CHECK = true // TEMPORARY: Bypass operator role check for testing

// Initial mock WO values for testing when Supabase not configured
const MOCK_WO_INITIAL = {
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
  customerName,
  customerCode,
  modelName,
  user,
  onExit,
  isOperator = false,
}) {
  const router = useRouter()
  const { showSidebar } = useSidebar()
  const { logout } = useAuth()
  const { t } = useI18n()
  
  // Work Order hooks
  const { workOrder: fetchedWO, hasActiveWO: fetchedHasWO, loading: woLoading, refresh: refreshWO } = useActiveWorkOrder(lineId)
  const { updateCounters } = useWorkOrderMutations()

  // Mock WO state (mutable, so counters update in real-time)
  const [mockWorkOrder, setMockWorkOrder] = useState(MOCK_WO_INITIAL)

  // Use mock WO if bypass enabled and no real WO
  const workOrder = (BYPASS_WO_CHECK && !fetchedWO) ? mockWorkOrder : fetchedWO
  const hasActiveWO = BYPASS_WO_CHECK || fetchedHasWO

  // Model selector state (fallback to localStorage if prop is empty)
  // Must be defined BEFORE useLiveInspection so the resolved model name is available
  const [currentModel, setCurrentModel] = useState(() => {
    if (modelName) return modelName
    try {
      const saved = JSON.parse(localStorage.getItem(`indusia_line_model_${lineId}`))
      return saved?.modelName || ''
    } catch { return '' }
  })

  // Live Inspection hook (SSE connection) - ONLY for Operator
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
    stopProcess,
    switchModel
  } = useLiveInspection(lineId, workOrder, {
    autoConnect: isOperator, // Only Operator connects to SSE
    modelName: currentModel || modelName,
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
  
  // Auto-NG toggle state (synced via API for all clients)
  const [autoNgEnabled, setAutoNgEnabled] = useState(true)

  const [availableModels, setAvailableModels] = useState([])
  const [isModelSwitching, setIsModelSwitching] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const modelDropdownRef = useRef(null)
  
  // Synced state from API (for VIEW ONLY mode)
  const [syncedState, setSyncedState] = useState({
    processStatus: 'IDLE',
    stage: {
      status: 'idle',
      stageName: 'idle', 
      message: 'Waiting for sync...',
      stageIndex: 0,
      totalStages: 7
    },
    hardware: { cameras: [], plcs: [] },
    currentInspection: null,
    autoNgEnabled: true  // Add autoNgEnabled to synced state
  })
  const [syncLoaded, setSyncLoaded] = useState(false)
  
  // Fetch line state from API
  const fetchLineState = useCallback(async () => {
    try {
      const response = await authFetch(`/api/inspection/line-state/${lineId}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        // Calculate new autoNgEnabled value
        const newAutoNgEnabled = result.data.autoNgEnabled ?? true
        
        // Only update local autoNgEnabled for Operator
        // Manager uses syncedState.autoNgEnabled exclusively
        if (isOperator) {
          setAutoNgEnabled(newAutoNgEnabled)
        }
        
        // Create new synced state object
        const newSyncedState = {
          processStatus: result.data.processStatus || 'IDLE',
          stage: result.data.stage || {
            status: 'idle',
            stageName: 'idle',
            message: 'Waiting for board...',
            stageIndex: 0,
            totalStages: 7
          },
          hardware: result.data.hardware || { cameras: [], plcs: [] },
          currentInspection: result.data.currentInspection,
          autoNgEnabled: newAutoNgEnabled
        }
        
        setSyncedState(newSyncedState)
        setSyncLoaded(true)
      }
    } catch (error) {
      console.warn('[LiveView] Failed to fetch line state:', error)
    }
  }, [lineId, isOperator])
  
  // Save line state to API (full state sync)
  const saveLineState = useCallback(async (updates) => {
    try {
      const response = await authFetch(`/api/inspection/line-state/${lineId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updates,
          updatedBy: user?.name || 'Unknown'
        })
      })
      const result = await response.json()
      if (result.success && result.data) {
        setAutoNgEnabled(result.data.autoNgEnabled)
      }
    } catch (error) {
      console.warn('[LiveView] Failed to save line state:', error)
    }
  }, [lineId, user])
  
  // Load initial state from API on mount
  useEffect(() => {
    if (lineId) {
      fetchLineState()
    }
  }, [lineId, fetchLineState])
  
  // OPERATOR: Push SSE state to API whenever it changes
  // Using ref to track last synced state and prevent unnecessary API calls
  const lastSyncedRef = useRef(null)
  const lastAutoNgRef = useRef(autoNgEnabled)
  
  useEffect(() => {
    if (!isOperator || !lineId) return
    
    // Check if autoNgEnabled changed specifically (high priority sync)
    const autoNgChanged = lastAutoNgRef.current !== autoNgEnabled
    lastAutoNgRef.current = autoNgEnabled
    
    // Create state snapshot - INCLUDE autoNgEnabled for consistent sync
    const stateToSync = {
      processStatus,
      stage: inspectionStage,
      hardware: hardwareStatus,
      currentInspection: currentInspection,
      autoNgEnabled: autoNgEnabled,  // Always include for sync consistency
      modelName: currentModel || modelName || null
    }
    
    // Compare with last synced to avoid unnecessary API calls
    // Include all stage fields to catch status/message/totalStages changes
    const stateKey = JSON.stringify({
      processStatus,
      stageName: inspectionStage?.stageName,
      stageIndex: inspectionStage?.stageIndex,
      stageStatus: inspectionStage?.status,
      totalStages: inspectionStage?.totalStages,
      hasInspection: !!currentInspection,
      inspectionId: currentInspection?.inspection_id || currentInspection?.inspectionId,
      verdict: currentInspection?.verdict || currentInspection?.result,
      autoNgEnabled,
      modelName: currentModel || modelName || null
    })
    
    // Skip if no change (unless autoNg specifically changed - force sync)
    if (lastSyncedRef.current === stateKey && !autoNgChanged) {
      return // No change, skip sync
    }
    
    lastSyncedRef.current = stateKey
    
    // Push to API (silent)
    authFetch(`/api/inspection/line-state/${lineId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...stateToSync,
        updatedBy: user?.name || 'Unknown'
      })
    }).catch(err => console.warn('[LiveView] Sync failed:', err))
    
  }, [isOperator, lineId, processStatus, inspectionStage, hardwareStatus, currentInspection, autoNgEnabled, user])
  
  // Toggle Auto-NG (operator only)
  // State change triggers push effect which syncs to API
  const toggleAutoNg = useCallback(() => {
    if (!isOperator) return
    setAutoNgEnabled(prev => !prev)
  }, [isOperator])
  
  // Process control wrappers that save state to API
  const handleRunProcess = useCallback(async () => {
    await runProcess()
    saveLineState({ processStatus: 'RUNNING' })
  }, [runProcess, saveLineState])
  
  const handlePauseProcess = useCallback(async () => {
    await pauseProcess()
    saveLineState({ processStatus: 'PAUSED' })
  }, [pauseProcess, saveLineState])
  
  const handleStopProcess = useCallback(async () => {
    await stopProcess()
    saveLineState({ processStatus: 'STOPPED' })
  }, [stopProcess, saveLineState])
  
  // Timer states for NG review timeout
  const [reviewCountdown, setReviewCountdown] = useState(NG_REVIEW_TIMEOUT_SECONDS)
  const reviewTimerRef = useRef(null)
  
  // Track if current inspection has been processed (prevent double submit)
  const processedInspectionRef = useRef(null)

  // Board sequence (for local tracking)
  const boardSequenceRef = useRef(workOrder?.completedQty || 0)
  
  // Sync boardSequenceRef when workOrder changes (important for page refresh/reconnect)
  useEffect(() => {
    if (workOrder?.completedQty !== undefined) {
      // Only update if DB value is higher (avoid going backwards)
      if (workOrder.completedQty > boardSequenceRef.current) {
        console.log(`[LiveView] Syncing boardSequence: ${boardSequenceRef.current} → ${workOrder.completedQty}`)
        boardSequenceRef.current = workOrder.completedQty
      }
    }
  }, [workOrder?.completedQty])

  // Dev mode: Mock inspection state
  const [devMockInspection, setDevMockInspection] = useState(null)
  const [devMockStage, setDevMockStage] = useState({
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 7,  // Match 7-stage flow
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

  // VIEW ONLY mode: Fast polling for line state (500ms) + slow polling for WO data (5s)
  // Line state needs fast refresh for real-time stage/inspection updates
  // Work order data changes rarely - polling every 5s is sufficient
  useEffect(() => {
    if (!isOperator && workOrder && lineId) {
      // Initial fetch immediately
      fetchLineState()

      // Fast interval: line state only (500ms)
      const stateInterval = setInterval(fetchLineState, 500)

      // Slow interval: work order refresh (5s)
      const woInterval = setInterval(refreshWO, 5000)

      return () => {
        clearInterval(stateInterval)
        clearInterval(woInterval)
      }
    }
  }, [isOperator, workOrder, lineId, refreshWO, fetchLineState])

  // Note: VIEW ONLY mode no longer needs stage reset detection
  // because Manager now uses syncedState exclusively from API

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

  // Fetch available boards on mount (operator only)
  useEffect(() => {
    if (!isOperator) return
    async function fetchBoards() {
      try {
        const response = await authFetch('/api/master-data/boards')
        const result = await response.json()
        if (result.success && result.data) {
          setAvailableModels(result.data)
        }
      } catch (err) {
        console.warn('[LiveView] Failed to fetch boards:', err)
      }
    }
    fetchBoards()
  }, [isOperator])

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false)
      }
    }
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModelDropdown])

  // DEBUG: Log effective AUTO-NG state (disabled - uncomment for troubleshooting)
  // useEffect(() => {
  //   const effective = isOperator ? autoNgEnabled : syncedState.autoNgEnabled
  //   console.log(`[DEBUG ${isOperator ? 'Operator' : 'Manager'}] AUTO-NG render:`, {
  //     isOperator,
  //     localAutoNg: autoNgEnabled,
  //     syncedAutoNg: syncedState.autoNgEnabled,
  //     effectiveAutoNg: effective,
  //     willShowON: effective === true
  //   })
  // }, [isOperator, autoNgEnabled, syncedState.autoNgEnabled])

  // Calculate yield from WO data
  const yieldPercent = workOrder?.completedQty > 0 
    ? ((workOrder.goodQty / workOrder.completedQty) * 100).toFixed(1) 
    : '0.0'

  // Determine active inspection data
  // Operator: use SSE currentInspection or dev mock
  // VIEW ONLY: ONLY use synced state from API (no fallback to local SSE)
  const activeInspection = isOperator 
    ? (currentInspection || devMockInspection)
    : syncedState.currentInspection
  
  // Determine active stage
  // Operator: use SSE inspectionStage or dev mock
  // VIEW ONLY: ONLY use synced state from API
  const activeStage = isOperator
    ? ((isConnected || inspectionStage.stageName !== 'idle') ? inspectionStage : devMockStage)
    : (syncedState.stage || {
        status: 'idle',
        stageName: 'idle',
        message: 'Syncing...',
        stageIndex: 0,
        totalStages: 7
      })

  // Determine AI result for UI
  const aiResult = activeInspection?.decision === 'PASS' ? 'GOOD' : 
                   activeInspection?.decision === 'FAIL' ? 'NG' : 'WAITING'

  // Determine effective process status
  // Operator: use SSE processStatus, VIEW ONLY: use synced from API
  const effectiveProcessStatus = isOperator ? processStatus : syncedState.processStatus
  
  // Determine effective hardware status
  // Operator: use SSE hardwareStatus, VIEW ONLY: use synced from API
  const effectiveHardwareStatus = isOperator 
    ? hardwareStatus 
    : (syncedState.hardware || { cameras: [], plcs: [] })
  
  // Determine effective AUTO-NG state
  // Operator: use local state, VIEW ONLY: use synced from API
  const effectiveAutoNgEnabled = isOperator 
    ? autoNgEnabled 
    : syncedState.autoNgEnabled

  // ============================================
  // Action Handlers
  // ============================================

  /**
   * Switch AI model on the backend
   * Only allowed when machine is not RUNNING
   */
  const handleModelSwitch = useCallback(async (newModelName) => {
    if (isModelSwitching || newModelName === currentModel) return
    if (processStatus === 'RUNNING') return

    setIsModelSwitching(true)
    setShowModelDropdown(false)

    try {
      const result = await switchModel(newModelName)
      if (result.success) {
        setCurrentModel(newModelName)
        // Persist last-used model per line
        try {
          localStorage.setItem(`indusia_line_model_${lineId}`, JSON.stringify({
            modelName: newModelName,
            selectedAt: new Date().toISOString()
          }))
        } catch (e) { /* localStorage unavailable */ }
      } else {
        console.error('[LiveView] Model switch failed:', result.error)
      }
    } catch (err) {
      console.error('[LiveView] Model switch error:', err)
    } finally {
      setIsModelSwitching(false)
    }
  }, [isModelSwitching, currentModel, processStatus, switchModel, lineId])

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
          const uploadResponse = await authFetch('/api/inspection/upload-false-call', {
            method: 'POST',
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
          
          // Step 2: Create Override record for Manager review
          const overridePayload = {
            board_id: boardId,
            section_id: sectionId,
            line_id: lineId,
            customer_id: customerId,
            override_type: overrideType,
            defect_type: overrideType,
            reason: falseCallData?.reason || 'UNSPECIFIED',
            operator_notes: falseCallData?.notes || '',
            operator_id: user?.id,
            operator_name: user?.name,
            local_image_path: localPaths?.top?.[0]?.path || localPaths?.bottom?.[0]?.path || '',
            local_image_paths: JSON.stringify(localPaths),
          }
          
          const overrideResponse = await authFetch('/api/overrides', {
            method: 'POST',
            body: JSON.stringify(overridePayload)
          })
          
          const overrideResult = await overrideResponse.json()
          
          if (!overrideResult.success) {
            console.error('[LiveView] Override creation failed:', overrideResult.error)
          }
        } catch (err) {
          console.error('[LiveView] False call process error:', err)
        }
      }

      // 3. Save to database + update counters
      if (fetchedWO) {
        // Real WO: persist to database
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

        // 4. Update WO counters in DB
        const counterUpdate = operatorDecision === 'GOOD'
          ? { goodQty: 1, completedQty: 1 }
          : { ngQty: 1, completedQty: 1 }

        if (isFalseCall) {
          counterUpdate.falseCallQty = 1
        }

        try {
          const counterResult = await updateCounters(workOrder.id, counterUpdate)
          console.log('[LiveView] Counter update:', counterResult?.success ? 'OK' : counterResult?.error)
        } catch (dbError) {
          console.warn('[LiveView] Update counters failed:', dbError)
        }

        // 6. Refresh WO data from DB (await to ensure stats update in UI)
        try {
          await refreshWO()
        } catch (refreshErr) {
          console.warn('[LiveView] WO refresh failed:', refreshErr)
        }
      } else if (BYPASS_WO_CHECK) {
        // Mock WO: update counters locally in state
        setMockWorkOrder(prev => ({
          ...prev,
          completedQty: prev.completedQty + 1,
          goodQty: operatorDecision === 'GOOD' ? prev.goodQty + 1 : prev.goodQty,
          ngQty: operatorDecision === 'NG' ? prev.ngQty + 1 : prev.ngQty,
          falseCallQty: isFalseCall ? prev.falseCallQty + 1 : prev.falseCallQty,
        }))
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
          totalStages: 7,  // Match 7-stage flow
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

    // Simulate stages (7-stage flow for dual-side inspection)
    const stages = ['board_incoming', 'position_1', 'position_2', 'pcb_flipping', 'position_3', 'position_4', 'done']
    
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      setDevMockStage({
        status: stage === 'done' ? 'ready' : 'processing',
        stageName: stage,
        message: stage === 'done' ? 'Ready for review' : 
                 stage === 'pcb_flipping' ? 'Flipping PCB...' : 
                 `Processing ${stage}...`,
        stageIndex: i + 1,
        totalStages: 7,
        icon: stage === 'done' ? 'check' : stage === 'pcb_flipping' ? 'rotate-ccw' : 'cpu'
      })
      await new Promise(r => setTimeout(r, 200)) // Fast simulation
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
                {(customerName || workOrder?.customer?.name || workOrder?.customerName) && (
                  <span className="text-phosphor-cyan ml-2">- {customerName || workOrder?.customer?.name || workOrder?.customerName}</span>
                )}
              </h1>
              <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
                LIVE INSPECTION
              </p>
            </div>
          </div>

        </div>

        {/* Center: WO Info only (simplified) */}
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

          {/* NG Review Countdown - only show when AI FAIL and Auto-NG is ON */}
          {aiResult === 'NG' && activeInspection && effectiveAutoNgEnabled && (
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
          {aiResult === 'NG' && activeInspection && !effectiveAutoNgEnabled && (
            <div className="flex items-center gap-2 px-3 py-2 border border-phosphor-cyan bg-phosphor-cyan/10">
              <span className="font-mono text-sm text-phosphor-cyan">MANUAL MODE</span>
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

          {/* Last Sync & Notification Bell (for Manager/Engineer) */}
          <HeaderInfoBar />

          {/* Volume Control - Only for Operator */}
          {isOperator && (
            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={setVolume}
              onMuteToggle={toggleMute}
              onTest={testAudio}
            />
          )}

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
            onClick={handleRunProcess}
            disabled={!isOperator || !isConnected || isControlling || effectiveProcessStatus === 'RUNNING'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              effectiveProcessStatus === 'RUNNING'
                ? "bg-phosphor-green border-phosphor-green text-void"
                : isOperator && isConnected && effectiveProcessStatus !== 'RUNNING'
                  ? "border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Play className="w-4 h-4" />
            <span>RUN</span>
          </button>

          {/* PAUSE Button */}
          <button
            onClick={handlePauseProcess}
            disabled={!isOperator || !isConnected || isControlling || effectiveProcessStatus !== 'RUNNING'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              effectiveProcessStatus === 'PAUSED'
                ? "bg-phosphor-amber border-phosphor-amber text-void"
                : isOperator && isConnected && effectiveProcessStatus === 'RUNNING'
                  ? "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Pause className="w-4 h-4" />
            <span>PAUSE</span>
          </button>

          {/* STOP Button */}
          <button
            onClick={handleStopProcess}
            disabled={!isOperator || !isConnected || isControlling || effectiveProcessStatus === 'IDLE' || effectiveProcessStatus === 'STOPPED'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              effectiveProcessStatus === 'STOPPED'
                ? "bg-phosphor-red border-phosphor-red text-void"
                : isOperator && isConnected && effectiveProcessStatus !== 'IDLE' && effectiveProcessStatus !== 'STOPPED'
                  ? "border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void"
                  : "border-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            <Square className="w-4 h-4" />
            <span>STOP</span>
          </button>
        </div>

        {/* Center: spacer (stage indicator is in body InspectionStage component) */}
        <div />

        {/* Right: Model + Hardware Status */}
        <div className="flex items-center gap-3">
          {/* AI Model Selector (Operator only) */}
          {isOperator && (
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => {
                  if (processStatus === 'RUNNING') return
                  setShowModelDropdown(prev => !prev)
                }}
                disabled={isModelSwitching}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 border transition-all",
                  processStatus === 'RUNNING'
                    ? "border-surface-border bg-surface-border/10 cursor-not-allowed opacity-60"
                    : "border-purple-500/50 bg-purple-500/5 hover:border-purple-400",
                  isModelSwitching && "animate-pulse"
                )}
                title={processStatus === 'RUNNING' ? "Stop or pause to change model" : "Change AI model"}
              >
                {isModelSwitching ? (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4 text-purple-400" />
                )}
                <span className="font-mono text-xs font-bold text-purple-400 max-w-[120px] truncate">
                  {currentModel || 'No Model'}
                </span>
                {processStatus !== 'RUNNING' && (
                  <ChevronDown className={cn(
                    "w-3 h-3 text-purple-400 transition-transform",
                    showModelDropdown && "rotate-180"
                  )} />
                )}
              </button>

              {/* Model Dropdown */}
              {showModelDropdown && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-panel border border-purple-500/50 shadow-lg z-50 max-h-64 overflow-y-auto">
                  {availableModels.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                      <span className="font-mono text-xs text-text-tertiary">No models available</span>
                    </div>
                  ) : (
                    availableModels.map(model => (
                      <button
                        key={model.id}
                        onClick={() => handleModelSwitch(model.name)}
                        disabled={model.name === currentModel}
                        className={cn(
                          "w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors",
                          model.name === currentModel
                            ? "bg-purple-500/10 border-l-2 border-l-purple-400"
                            : "hover:bg-surface-border/30 border-l-2 border-l-transparent"
                        )}
                      >
                        <Brain className={cn(
                          "w-4 h-4 flex-shrink-0",
                          model.name === currentModel ? "text-purple-400" : "text-text-tertiary"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-mono text-sm font-bold truncate",
                            model.name === currentModel ? "text-purple-400" : "text-text-primary"
                          )}>
                            {model.name}
                          </p>
                          {model.customer?.name && (
                            <p className="font-mono text-[10px] text-text-tertiary">
                              {model.customer.name}
                            </p>
                          )}
                        </div>
                        {model.name === currentModel && (
                          <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Camera Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            effectiveHardwareStatus?.cameras?.[0]?.status === 'ONLINE' 
              ? "border-phosphor-green/50 bg-phosphor-green/5" 
              : effectiveHardwareStatus?.cameras?.length > 0
                ? "border-phosphor-red/50 bg-phosphor-red/5"
                : "border-surface-border bg-surface-border/10"
          )}>
            <Camera className={cn(
              "w-4 h-4",
              effectiveHardwareStatus?.cameras?.[0]?.status === 'ONLINE' 
                ? "text-phosphor-green" 
                : effectiveHardwareStatus?.cameras?.length > 0
                  ? "text-phosphor-red"
                  : "text-text-tertiary"
            )} />
            <span className="font-mono text-xs text-text-secondary">CAM</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              effectiveHardwareStatus?.cameras?.[0]?.status === 'ONLINE' 
                ? "bg-phosphor-green" 
                : effectiveHardwareStatus?.cameras?.length > 0
                  ? "bg-phosphor-red animate-pulse"
                  : "bg-surface-border"
            )} />
          </div>

          {/* PLC Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            effectiveHardwareStatus?.plcs?.[0]?.status === 'ONLINE' 
              ? "border-phosphor-green/50 bg-phosphor-green/5" 
              : effectiveHardwareStatus?.plcs?.length > 0
                ? "border-phosphor-red/50 bg-phosphor-red/5"
                : "border-surface-border bg-surface-border/10"
          )}>
            <Activity className={cn(
              "w-4 h-4",
              effectiveHardwareStatus?.plcs?.[0]?.status === 'ONLINE' 
                ? "text-phosphor-green" 
                : effectiveHardwareStatus?.plcs?.length > 0
                  ? "text-phosphor-red"
                  : "text-text-tertiary"
            )} />
            <span className="font-mono text-xs text-text-secondary">PLC</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              effectiveHardwareStatus?.plcs?.[0]?.status === 'ONLINE' 
                ? "bg-phosphor-green" 
                : effectiveHardwareStatus?.plcs?.length > 0
                  ? "bg-phosphor-red animate-pulse"
                  : "bg-surface-border"
            )} />
          </div>

          {/* Auto-NG Toggle (Operator) / Indicator (Manager) */}
          {isOperator ? (
            <button
              onClick={toggleAutoNg}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border transition-all",
                effectiveAutoNgEnabled 
                  ? "border-phosphor-amber bg-phosphor-amber/10" 
                  : "border-surface-border bg-surface-border/10",
                "hover:border-text-tertiary"
              )}
              title={effectiveAutoNgEnabled ? "Auto-NG ON: Will auto-reject after 15s" : "Auto-NG OFF: Manual confirmation required"}
            >
              {effectiveAutoNgEnabled ? (
                <ToggleRight className="w-4 h-4 text-phosphor-amber" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-text-tertiary" />
              )}
              <span className={cn(
                "font-mono text-xs font-bold",
                effectiveAutoNgEnabled ? "text-phosphor-amber" : "text-text-tertiary"
              )}>
                AUTO-NG
              </span>
            </button>
          ) : (
            /* Manager: Read-only indicator */
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 border",
              effectiveAutoNgEnabled 
                ? "border-phosphor-amber bg-phosphor-amber/10" 
                : "border-surface-border bg-surface-border/10"
            )}>
              {effectiveAutoNgEnabled ? (
                <ToggleRight className="w-4 h-4 text-phosphor-amber" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-text-tertiary" />
              )}
              <span className={cn(
                "font-mono text-xs font-bold",
                effectiveAutoNgEnabled ? "text-phosphor-amber" : "text-text-tertiary"
              )}>
                AUTO-NG {effectiveAutoNgEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          )}
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
              processStatus={effectiveProcessStatus}
              onResume={handleRunProcess}
              isOperator={isOperator}
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
          {/* Dev Mode Simulate Buttons - ONLY for Operator */}
          {DEV_MODE && isOperator && !activeInspection && !aiBackendAvailable && (
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

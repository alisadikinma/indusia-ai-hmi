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
  Brain, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useActiveWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders'
import { useLiveInspection } from '@/hooks/useLiveInspection'
import { useAudioFeedback } from '@/hooks/useAudioFeedback'
import { clearOverridesCache } from '@/hooks/useOverrides'

// Components
import { InspectionStage } from './InspectionStage'
import { InspectionResult } from './InspectionResult'
import { FalseCallModal } from './FalseCallModal'
import { CavityReviewOverlay } from './CavityReviewOverlay'
import { VolumeControl } from './VolumeControl'
import { HeaderInfoBar } from './HeaderInfoBar'

// Services
import { saveInspection } from '@/lib/services/inspectionService'
import { getInspectionResult } from '@/lib/services/imageService'
import { authFetch } from '@/lib/utils/authFetch'
import { findNextUnreviewedFrame, computePcbCounts } from '@/lib/utils/inspectionReview'

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
  const { logout, clearActiveLine } = useAuth()
  const { t } = useI18n()
  
  // Work Order hooks
  const { workOrder: fetchedWO, hasActiveWO: fetchedHasWO, lastCompleted: lastCompletedWO, loading: woLoading, refresh: refreshWO } = useActiveWorkOrder(lineId)
  const { updateCounters } = useWorkOrderMutations()

  // Mock WO state (mutable, so counters update in real-time)
  const [mockWorkOrder, setMockWorkOrder] = useState(MOCK_WO_INITIAL)

  // Use mock WO if bypass enabled and no real WO
  const workOrder = (BYPASS_WO_CHECK && !fetchedWO) ? mockWorkOrder : fetchedWO
  const hasActiveWO = BYPASS_WO_CHECK || fetchedHasWO

  // Optimistic counter tracking — updates UI instantly on each decision
  // without waiting for DB round-trip (real WO path only).
  // Restored from localStorage on mount to survive page refresh/browser close.
  const COUNTER_STORAGE_PREFIX = `indusia_session_counters_${lineId}_`
  const COUNTER_ZERO = { completedQty: 0, goodQty: 0, ngQty: 0, falseCallQty: 0 }

  const [sessionCounters, setSessionCounters] = useState(() => {
    if (typeof window === 'undefined') return COUNTER_ZERO
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(COUNTER_STORAGE_PREFIX))
      let latest = null
      for (const key of keys) {
        const data = JSON.parse(localStorage.getItem(key))
        if (data?.counters && (!latest || data.timestamp > latest.timestamp)) latest = data
      }
      // Expire after 24 hours (stale from previous shift)
      if (latest && (Date.now() - latest.timestamp) < 24 * 60 * 60 * 1000) {
        console.log('[LiveView] Restored sessionCounters from localStorage:', latest.counters)
        return latest.counters
      }
    } catch (e) { /* localStorage unavailable */ }
    return COUNTER_ZERO
  })
  const lastKnownServerRef = useRef(null)

  // Persist sessionCounters to localStorage on every change
  useEffect(() => {
    if (!workOrder?.id) return
    try {
      localStorage.setItem(`${COUNTER_STORAGE_PREFIX}${workOrder.id}`, JSON.stringify({
        counters: sessionCounters,
        timestamp: Date.now(),
        woId: workOrder.id,
      }))
    } catch (e) { /* quota or private browsing */ }
  }, [sessionCounters, workOrder?.id, COUNTER_STORAGE_PREFIX])

  // Validate restored sessionCounters match current WO — reset if WO changed
  useEffect(() => {
    if (!workOrder?.id) return
    try {
      const staleKeys = Object.keys(localStorage).filter(k =>
        k.startsWith(COUNTER_STORAGE_PREFIX) && !k.endsWith(`_${workOrder.id}`)
      )
      if (staleKeys.length > 0) {
        console.log('[LiveView] Clearing stale sessionCounters from different WO')
        setSessionCounters(COUNTER_ZERO)
        staleKeys.forEach(k => localStorage.removeItem(k))
      }
    } catch (e) { /* ignore */ }
  }, [workOrder?.id, COUNTER_STORAGE_PREFIX])

  // Reconcile session counters when server data catches up via refreshWO
  useEffect(() => {
    if (!fetchedWO) return
    const serverNow = {
      completedQty: fetchedWO.completedQty || 0,
      goodQty: fetchedWO.goodQty || 0,
      ngQty: fetchedWO.ngQty || 0,
      falseCallQty: fetchedWO.falseCallQty || 0,
    }

    // If server counters dropped (WO reset externally), clear session counters
    // This handles: admin reset counters in DB, or lot_size changed and counters zeroed
    if (lastKnownServerRef.current) {
      const prev = lastKnownServerRef.current
      if (serverNow.completedQty < prev.completedQty) {
        console.log('[LiveView] Server counters dropped (WO reset detected), clearing sessionCounters')
        setSessionCounters(COUNTER_ZERO)
        setWoCompleted(false)
        lastKnownServerRef.current = serverNow
        return
      }
    } else {
      // First load: if server is at 0 but session counters are non-zero, it's a stale restore
      setSessionCounters(prev => {
        if (serverNow.completedQty === 0 && prev.completedQty > 0) {
          console.log('[LiveView] Server at 0 but sessionCounters restored from localStorage, clearing')
          return COUNTER_ZERO
        }
        return prev
      })
    }

    if (lastKnownServerRef.current) {
      const prev = lastKnownServerRef.current
      const serverDelta = {
        completedQty: serverNow.completedQty - prev.completedQty,
        goodQty: serverNow.goodQty - prev.goodQty,
        ngQty: serverNow.ngQty - prev.ngQty,
        falseCallQty: serverNow.falseCallQty - prev.falseCallQty,
      }
      // Server caught up — reduce local offsets to avoid double-counting
      if (serverDelta.completedQty > 0 || serverDelta.goodQty > 0 || serverDelta.ngQty > 0 || serverDelta.falseCallQty > 0) {
        setSessionCounters(prev => ({
          completedQty: Math.max(0, prev.completedQty - serverDelta.completedQty),
          goodQty: Math.max(0, prev.goodQty - serverDelta.goodQty),
          ngQty: Math.max(0, prev.ngQty - serverDelta.ngQty),
          falseCallQty: Math.max(0, prev.falseCallQty - serverDelta.falseCallQty),
        }))
      }
    }
    lastKnownServerRef.current = serverNow
  }, [fetchedWO])

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
    queueLength,
    panelProgress,
    connect,
    disconnect,
    reconnect,
    checkAiBackend,
    clearInspection,
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
  const [showCavityOverlay, setShowCavityOverlay] = useState(false)
  const falseCallInspectionRef = useRef(null) // Capture inspection data when modal opens
  const [falseCallReasons, setFalseCallReasons] = useState([])
  const [pendingDecision, setPendingDecision] = useState(null) // 'GOOD' or 'NG'
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)
  
  // Auto-NG toggle state (synced via API for all clients) - default OFF
  const [autoNgEnabled, setAutoNgEnabled] = useState(false)

  // Inline NG frame review state (manual mode — no overlay, per-frame in footer)
  const [ngFrameReview, setNgFrameReview] = useState(null)
  // Shape: { frames: [{ ...frame, side, frameIndex }], currentIndex: 0, decisions: {} }
  const [inlineReasonInput, setInlineReasonInput] = useState(false) // Show reason dropdown in footer
  const [inlineSelectedReason, setInlineSelectedReason] = useState('')
  const [inlineOtherText, setInlineOtherText] = useState('')
  const overlayDelayRef = useRef(null) // Timer for 5s delay before AUTO-NG overlay
  const [cavityInitialIndex, setCavityInitialIndex] = useState(0) // Initial frame index for CavityReviewOverlay

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
      totalStages: 0
    },
    hardware: { cameras: [], plcs: [] },
    currentInspection: null,
    autoNgEnabled: false,
    workOrderCounters: null,
    cycleTime: null
  })
  const [syncLoaded, setSyncLoaded] = useState(false)
  
  // Fetch line state from API
  // Track woCounterVersion — when override review patches counters,
  // line-state version is bumped. Detect change → trigger refreshWO().
  const woCounterVersionRef = useRef(0)

  const fetchLineState = useCallback(async () => {
    try {
      const response = await authFetch(`/api/inspection/line-state/${lineId}`)
      const result = await response.json()

      if (result.success && result.data) {
        // Detect external WO counter changes (e.g. override review patched counters)
        const serverVersion = result.data.woCounterVersion || 0
        if (serverVersion > woCounterVersionRef.current) {
          woCounterVersionRef.current = serverVersion
          // Trigger WO refresh to pick up corrected counters from DB
          refreshWO()
        }

        // Calculate new autoNgEnabled value (default OFF)
        const newAutoNgEnabled = result.data.autoNgEnabled ?? false

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
            totalStages: 0
          },
          hardware: result.data.hardware || { cameras: [], plcs: [] },
          currentInspection: result.data.currentInspection,
          autoNgEnabled: newAutoNgEnabled,
          workOrderCounters: result.data.workOrderCounters || null,
          cycleTime: result.data.cycleTime || null
        }

        setSyncedState(newSyncedState)
        setSyncLoaded(true)

        // Initialize cycle time from persisted state on first load (operator only)
        // This ensures the cycle time indicator shows immediately after page reload
        if (isOperator && newSyncedState.cycleTime != null && lastCycleTimeRef.current == null) {
          lastCycleTimeRef.current = newSyncedState.cycleTime
          setDisplayCycleTime(newSyncedState.cycleTime)
        }

        // Line-state recovery: if sessionCounters are zero (no localStorage backup)
        // but line-state has higher effective counters than DB base, recover the delta.
        // This handles the case where updateCounters() failed but line-state was pushed.
        // IMPORTANT: Only recover if WO ID matches — prevents stale counters from previous WO.
        if (isOperator && workOrder && newSyncedState.workOrderCounters) {
          const lsCounters = newSyncedState.workOrderCounters
          // Skip recovery if line-state has counters from a different WO
          if (lsCounters.workOrderId && workOrder.id && lsCounters.workOrderId !== workOrder.id) {
            console.log('[LiveView] Line-state has counters from different WO, skipping recovery')
          } else {
            setSessionCounters(prev => {
              const isSessionEmpty = prev.completedQty === 0 && prev.goodQty === 0 && prev.ngQty === 0
              if (!isSessionEmpty) return prev // Already have data (from localStorage), skip
              const recovered = {
                completedQty: Math.max(0, (lsCounters.completedQty || 0) - (workOrder.completedQty || 0)),
                goodQty: Math.max(0, (lsCounters.goodQty || 0) - (workOrder.goodQty || 0)),
                ngQty: Math.max(0, (lsCounters.ngQty || 0) - (workOrder.ngQty || 0)),
                falseCallQty: Math.max(0, (lsCounters.falseCallQty || 0) - (workOrder.falseCallQty || 0)),
              }
              if (recovered.completedQty > 0) {
                console.log('[LiveView] Recovered sessionCounters from line-state:', recovered)
                return recovered
              }
              return prev
            })
          }
        }
      }
    } catch (error) {
      console.warn('[LiveView] Failed to fetch line state:', error)
    }
  }, [lineId, isOperator, refreshWO]) // eslint-disable-line react-hooks/exhaustive-deps

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
      modelName: currentModel || modelName || null,
      workOrderCounters: workOrder ? {
        workOrderId: workOrder.id || null,
        completedQty: (workOrder.completedQty || 0) + sessionCounters.completedQty,
        goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
        ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
        lotSize: workOrder.lotSize || 0,
        woNumber: workOrder.woNumber || null,
        falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
      } : null,
      cycleTime: lastCycleTimeRef.current
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
      modelName: currentModel || modelName || null,
      completedQty: (workOrder?.completedQty || 0) + sessionCounters.completedQty,
      goodQty: (workOrder?.goodQty || 0) + sessionCounters.goodQty,
      ngQty: (workOrder?.ngQty || 0) + sessionCounters.ngQty,
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
    
  }, [isOperator, lineId, processStatus, inspectionStage, hardwareStatus, currentInspection, autoNgEnabled, user, workOrder, sessionCounters])
  
  // Toggle Auto-NG (operator only)
  // State change triggers push effect which syncs to API
  const toggleAutoNg = useCallback(() => {
    if (!isOperator) return
    setAutoNgEnabled(prev => !prev)
  }, [isOperator])
  
  // WO completion state — shows overlay and blocks further production
  const [woCompleted, setWoCompleted] = useState(false)
  const [woOnHold, setWoOnHold] = useState(false)
  // Captured WO data at the moment of completion (prevents mock WO fallback showing wrong numbers)
  const [completedWoData, setCompletedWoData] = useState(null)
  // Tracks if user dismissed the completion modal (prevents re-showing on same page)
  const woCompletedDismissedRef = useRef(false)
  // Track WO ID transitions to reset counters when a new WO is assigned
  const prevFetchedWoIdRef = useRef(fetchedWO?.id || null)

  // Page-load case: if no active WO but there's a recently completed WO for this line,
  // show the completion modal with the REAL completed WO data (not mock placeholder)
  useEffect(() => {
    if (!woLoading && !fetchedWO && lastCompletedWO && !woCompletedDismissedRef.current) {
      console.log('[LiveView] No active WO, showing last completed:', lastCompletedWO.woNumber)
      setCompletedWoData({
        woNumber: lastCompletedWO.woNumber,
        lotSize: lastCompletedWO.lotSize,
        completedQty: lastCompletedWO.completedQty,
        goodQty: lastCompletedWO.goodQty,
        ngQty: lastCompletedWO.ngQty,
        falseCallQty: lastCompletedWO.falseCallQty,
      })
      setWoCompleted(true)
      // Clear stale sessionCounters — they belong to the completed WO
      setSessionCounters(COUNTER_ZERO)
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(COUNTER_STORAGE_PREFIX))
          .forEach(k => localStorage.removeItem(k))
      } catch (e) { /* ignore */ }
    }
  }, [woLoading, fetchedWO, lastCompletedWO, COUNTER_STORAGE_PREFIX])

  // Brief toast message shown when START is blocked (auto-dismissed after 4s)
  const [startBlockReason, setStartBlockReason] = useState(null)
  const showStartBlocked = useCallback((reason) => {
    setStartBlockReason(reason)
    setTimeout(() => setStartBlockReason(null), 4000)
  }, [])

  // Detect WO ID transitions — reset counters when a different WO is assigned
  useEffect(() => {
    const newId = fetchedWO?.id || null
    const prevId = prevFetchedWoIdRef.current

    if (prevId && newId && prevId !== newId) {
      console.log('[LiveView] WO changed:', prevId, '→', newId, '— resetting all counters')
      setSessionCounters(COUNTER_ZERO)
      setWoCompleted(false)
      setCompletedWoData(null)
      lastKnownServerRef.current = null
      // Clear all localStorage counter keys for this line
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(COUNTER_STORAGE_PREFIX))
          .forEach(k => localStorage.removeItem(k))
      } catch (e) { /* ignore */ }
      // Clear stale line-state counters so manager doesn't see old data
      saveLineState({ workOrderCounters: null })
    }

    prevFetchedWoIdRef.current = newId
  }, [fetchedWO?.id, COUNTER_STORAGE_PREFIX, saveLineState])

  // Reactive WO completion check — uses BOTH DB values and session counters.
  // DB values alone may be behind due to async counter updates, so we also check
  // the effective total (DB base + session offsets) to catch lot size completion
  // even when some counter updates haven't been persisted yet.
  // IMPORTANT: Only check real WO from DB, NOT mock WO placeholder.
  // Mock WO has arbitrary lotSize and stale sessionCounters would trigger false completion.
  useEffect(() => {
    if (!isOperator || !fetchedWO) return
    const dbCompleted = workOrder.completedQty || 0
    const effectiveCompleted = dbCompleted + sessionCounters.completedQty
    const isCompletedDB = workOrder.lotSize > 0 && dbCompleted >= workOrder.lotSize
    const isCompletedEffective = workOrder.lotSize > 0 && effectiveCompleted >= workOrder.lotSize
    const isCompleted = isCompletedDB || isCompletedEffective
    if (isCompleted && !woCompleted) {
      console.log('[LiveView] WO completed:', isCompletedDB ? `DB ${dbCompleted}` : `effective ${effectiveCompleted}`, '>=', workOrder.lotSize)
      // Capture final WO data NOW before fetchedWO becomes null (DB status → completed → hook returns null)
      setCompletedWoData({
        woNumber: workOrder.woNumber,
        lotSize: workOrder.lotSize,
        completedQty: effectiveCompleted,
        goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
        ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
        falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
      })
      setWoCompleted(true)
      if (processStatus === 'RUNNING' || processStatus === 'PAUSED') {
        stopProcess().catch(() => {})
        saveLineState({ processStatus: 'STOPPED' })
      }
    } else if (!isCompleted && woCompleted) {
      // WO was reset (counters cleared or lot_size increased) — dismiss overlay
      console.log('[LiveView] WO no longer completed:', effectiveCompleted, '<', workOrder.lotSize)
      setWoCompleted(false)
      setCompletedWoData(null)
    }
  }, [fetchedWO, workOrder, isOperator, woCompleted, processStatus, stopProcess, saveLineState, sessionCounters.completedQty])

  // Process control wrappers that save state to API
  const handleRunProcess = useCallback(async () => {
    // Block start if WO is completed (use effective total including session offsets)
    if (workOrder && workOrder.lotSize > 0) {
      const totalCompleted = (workOrder.completedQty || 0) + sessionCounters.completedQty
      if (totalCompleted >= workOrder.lotSize) {
        showStartBlocked(`Work Order ${workOrder.woNumber || ''} sudah selesai (${totalCompleted}/${workOrder.lotSize}). Silakan pilih Work Order baru.`)
        if (!completedWoData) {
          setCompletedWoData({
            woNumber: workOrder.woNumber, lotSize: workOrder.lotSize,
            completedQty: totalCompleted,
            goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
            ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
            falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
          })
        }
        setWoCompleted(true)
        return
      }
    }

    // Fresh check: verify WO is still active before starting machine
    try {
      const res = await authFetch(`/api/work-orders/active/${lineId}`)
      const json = await res.json()
      if (!json.success || !json.data) {
        console.warn('[LiveView] No active WO found on line, blocking start')
        showStartBlocked(`Work Order tidak aktif atau sedang On Hold. Hubungi supervisor untuk mengaktifkan WO.`)
        setWoOnHold(true)
        return
      }
    } catch (err) {
      console.error('[LiveView] Failed to check WO status:', err)
      // On network error, still allow start to avoid blocking production
    }

    setWoOnHold(false)
    await runProcess()
    saveLineState({ processStatus: 'RUNNING' })
  }, [runProcess, saveLineState, workOrder, sessionCounters.completedQty, lineId, showStartBlocked])
  
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

  // Serialization guard: prevents concurrent submitDecision calls that cause
  // race conditions in the server-side counter update (read-then-write).
  // Queued call is stored and executed after the current one finishes.
  const isSubmittingRef = useRef(false)
  const pendingSubmitRef = useRef(null)

  // Derive board layout from selected board (must be before boardSequenceRef sync)
  const activeBoard = availableModels.find(m => m.name === currentModel)
  const activeCavityCount = activeBoard?.cavityCount || 1
  const activeTopFrameCount = activeBoard?.topFrameCount || 0
  const activeBottomFrameCount = activeBoard?.bottomFrameCount || 0

  // Board sequence tracks PANEL count (not individual PCB count)
  // For multi-cavity: panel_count = completedQty / cavityCount
  const boardSequenceRef = useRef(Math.floor((workOrder?.completedQty || 0) / activeCavityCount))

  // Cycle time tracking
  const cycleStartTimeRef = useRef(null)
  const lastCycleTimeRef = useRef(null)
  const [displayCycleTime, setDisplayCycleTime] = useState(null)

  // Sync boardSequenceRef when workOrder changes (important for page refresh/reconnect)
  useEffect(() => {
    if (workOrder?.completedQty !== undefined) {
      const panelCount = Math.floor(workOrder.completedQty / activeCavityCount)
      // Only update if DB-derived panel count is higher (avoid going backwards)
      if (panelCount > boardSequenceRef.current) {
        console.log(`[LiveView] Syncing boardSequence: ${boardSequenceRef.current} → ${panelCount} (completedQty=${workOrder.completedQty}, cavityCount=${activeCavityCount})`)
        boardSequenceRef.current = panelCount
      }
    }
  }, [workOrder?.completedQty, activeCavityCount])

  // Cycle time tracking: start when stage begins, end when inspection result arrives
  // For multi-cavity panels: CYCLE/PCB = panel_time / cavity_count
  useEffect(() => {
    if (!isOperator) return
    const stageIdx = inspectionStage?.stageIndex || 0
    // Start timer when first stage begins
    if (stageIdx === 1 && !cycleStartTimeRef.current) {
      cycleStartTimeRef.current = Date.now()
    }
    // Complete timer when first inspection result arrives (≈ panel time for rapid-fire events)
    if (currentInspection && cycleStartTimeRef.current) {
      const panelElapsed = (Date.now() - cycleStartTimeRef.current) / 1000
      const perPcb = parseFloat((panelElapsed / activeCavityCount).toFixed(1))
      lastCycleTimeRef.current = perPcb
      setDisplayCycleTime(perPcb)
      cycleStartTimeRef.current = null
    }
    // Reset start time when stage resets to idle (new cycle)
    if (stageIdx === 0 && !currentInspection) {
      cycleStartTimeRef.current = null
    }
  }, [isOperator, inspectionStage?.stageIndex, currentInspection, activeCavityCount])

  // Stale state detection: When SSE connects to a running process but misses the inspection event
  // (e.g., page reload during result review), stages show "ready" but currentInspection is null.
  // After 5 seconds in this state, auto-reset stages to idle so operator can proceed.
  const staleTimerRef = useRef(null)
  useEffect(() => {
    if (!isOperator || !isConnected) {
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
      return
    }

    const isStaleState = inspectionStage?.status === 'ready' && !currentInspection
    if (isStaleState) {
      // Start 5-second timer to confirm it's actually stale (not just momentary)
      if (!staleTimerRef.current) {
        staleTimerRef.current = setTimeout(() => {
          // Still stale after 5 seconds — reset stages to idle so operator isn't stuck.
          // processStatus is NOT touched — the backend process may still be running.
          console.warn('[LiveView] Stale inspection state detected (stages=ready, no inspection data). Resetting stages to idle.')
          clearInspection()
          staleTimerRef.current = null
        }, 5000)
      }
    } else {
      // State resolved — clear timer
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current)
        staleTimerRef.current = null
      }
    }

    return () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current)
        staleTimerRef.current = null
      }
    }
  }, [isOperator, isConnected, inspectionStage?.status, currentInspection, clearInspection])

  // Dev mode: Mock inspection state
  const [devMockInspection, setDevMockInspection] = useState(null)
  const [devMockStage, setDevMockStage] = useState({
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 0,  // Dynamic — set by backend SSE events per model
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

  // Line-state polling — role-specific intervals
  // Manager: 500ms (fast — real-time stage/inspection updates)
  // Operator: 5s (slow — only checks woCounterVersion for external counter changes)
  // When woCounterVersion changes, fetchLineState auto-triggers refreshWO()
  useEffect(() => {
    if (!workOrder || !lineId) return
    fetchLineState()
    const interval = setInterval(fetchLineState, isOperator ? 5000 : 500)
    return () => clearInterval(interval)
  }, [workOrder, lineId, isOperator, fetchLineState])

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

  // Fetch false call reasons on mount (operator only)
  useEffect(() => {
    if (!isOperator) return
    async function fetchReasons() {
      try {
        const response = await authFetch('/api/master-data/false-call-reasons')
        const result = await response.json()
        if (result.success && result.data) {
          setFalseCallReasons(result.data)
        }
      } catch (err) {
        console.warn('[LiveView] Failed to fetch false call reasons:', err)
      }
    }
    fetchReasons()
  }, [isOperator])

  // NG PCB review flow: AUTO-NG (5s delay → overlay) or Manual (inline per-frame)
  useEffect(() => {
    if (!isOperator || !currentInspection) {
      // Clear overlay delay if inspection cleared
      if (overlayDelayRef.current) {
        clearTimeout(overlayDelayRef.current)
        overlayDelayRef.current = null
      }
      // Clear stale inline NG review when inspection is gone
      setNgFrameReview(null)
      return
    }

    // Collect NG frames
    const topFrames = currentInspection.results?.top || []
    const bottomFrames = currentInspection.results?.bottom || []
    const ngFrames = []
    topFrames.forEach((f, idx) => {
      if (f.label == true) ngFrames.push({ ...f, side: 'TOP', frameIndex: idx })
    })
    bottomFrames.forEach((f, idx) => {
      if (f.label == true) ngFrames.push({ ...f, side: 'BOTTOM', frameIndex: idx })
    })

    const hasNGFrames = ngFrames.length > 0
    const aiNG = currentInspection.decision === 'FAIL'

    if (hasNGFrames || aiNG) {
      if (autoNgEnabled) {
        // AUTO-NG mode: 5s delay before showing CavityReviewOverlay
        overlayDelayRef.current = setTimeout(() => {
          setCavityInitialIndex(0)
          setShowCavityOverlay(true)
          overlayDelayRef.current = null
        }, 5000)
      } else {
        // Manual mode: initialize inline per-frame review (no overlay)
        // Mark as processed so auto-proceed effect doesn't interfere
        const inspectionId = currentInspection.inspection_id || currentInspection.inspectionId
        processedInspectionRef.current = inspectionId
        falseCallInspectionRef.current = currentInspection
        setShowCavityOverlay(false)
        setNgFrameReview({
          frames: ngFrames.length > 0 ? ngFrames : [{ side: 'TOP', frameIndex: 0, label: true }],
          currentIndex: 0,
          decisions: {}
        })
      }
    } else {
      // GOOD PCB — no review needed
      setShowCavityOverlay(false)
      setNgFrameReview(null)
    }

    return () => {
      if (overlayDelayRef.current) {
        clearTimeout(overlayDelayRef.current)
        overlayDelayRef.current = null
      }
    }
  }, [isOperator, currentInspection, autoNgEnabled])

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

  // Effective counters: operator uses workOrder + optimistic session offsets, manager uses synced counters
  const effectiveCounters = isOperator
    ? (workOrder ? {
        ...workOrder,
        completedQty: (workOrder.completedQty || 0) + sessionCounters.completedQty,
        goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
        ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
        falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
      } : null)
    : (syncedState.workOrderCounters || workOrder)

  // Calculate yield from effective counter data
  const yieldPercent = effectiveCounters?.completedQty > 0
    ? ((effectiveCounters.goodQty / effectiveCounters.completedQty) * 100).toFixed(1)
    : '0.0'

  // Effective cycle time: operator uses local, manager uses synced
  const effectiveCycleTime = isOperator ? displayCycleTime : syncedState.cycleTime

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
        totalStages: 0
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
   * Compute per-PCB counter deltas using pcbCounts (grouped by serial_number).
   * TOP and BOTTOM with same SN = 1 physical PCB.
   * ngQty = unique PCBs with at least one REAL_NG frame.
   * goodQty = remaining PCBs (total - ngPcbs), including false calls and non-flagged.
   * Without pcbCounts, all qty goes to the board-level operatorDecision.
   */
  function computeCounterDeltas(qty, operatorDecision, falseCallData) {
    const pcbCounts = falseCallData?.pcbCounts
    console.log('[LiveView] computeCounterDeltas:', { qty, operatorDecision, pcbCounts, hasFalseCallData: !!falseCallData })
    if (pcbCounts) {
      // Clamp to cavity_count — frame grouping may report more "PCBs" than physical PCBs
      // when serial_number is null and top/bottom have different frame counts per PCB.
      const ngQty = Math.min(pcbCounts.ngPcbs, qty)
      const goodQty = qty - ngQty
      const falseCallCount = Math.min(pcbCounts.goodPcbs, goodQty)
      if (pcbCounts.ngPcbs > qty || pcbCounts.goodPcbs > goodQty) {
        console.warn('[LiveView] pcbCounts clamped to cavity_count=%d: ngPcbs %d→%d, goodPcbs %d→%d',
          qty, pcbCounts.ngPcbs, ngQty, pcbCounts.goodPcbs, falseCallCount)
      }
      return {
        goodQty,
        ngQty,
        falseCallCount,
      }
    }
    return {
      goodQty: operatorDecision === 'GOOD' ? qty : 0,
      ngQty: operatorDecision === 'NG' ? qty : 0,
      falseCallCount: 0,
    }
  }

  /**
   * Submit decision to AI Backend
   * (Defined first as other handlers depend on it)
   */
  const submitDecision = useCallback(async (operatorDecision, falseCallData = null) => {
    // Serialization guard: queue if another submitDecision is already running.
    // This prevents concurrent DB counter updates that cause race conditions
    // (two reads of the same base value → both write base+1 → one increment lost).
    if (isSubmittingRef.current) {
      console.log('[LiveView] submitDecision queued (previous still running):', operatorDecision)
      pendingSubmitRef.current = { operatorDecision, falseCallData }
      return
    }
    isSubmittingRef.current = true

    console.log('[LiveView] submitDecision called:', {
      operatorDecision,
      hasActiveInspection: !!activeInspection,
      hasWorkOrder: !!workOrder,
      hasFetchedWO: !!fetchedWO,
      workOrderId: workOrder?.id
    })

    // Always clear inline NG review — board is being confirmed
    setNgFrameReview(null)
    setInlineReasonInput(false)

    // Use captured inspection from modal as fallback (prevents stale closure when SSE clears currentInspection)
    const effectiveInspection = activeInspection || falseCallInspectionRef.current
    if (!effectiveInspection || !workOrder) {
      console.warn('[LiveView] submitDecision bailed: activeInspection=', !!activeInspection, 'capturedInspection=', !!falseCallInspectionRef.current, 'workOrder=', !!workOrder)
      isSubmittingRef.current = false
      // Process queued call if any
      const queued = pendingSubmitRef.current
      if (queued) {
        pendingSubmitRef.current = null
        submitDecision(queued.operatorDecision, queued.falseCallData)
      }
      return
    }

    // Client-side guard: block if WO already reached lot size
    if (workOrder.lotSize > 0) {
      const currentTotal = (workOrder.completedQty || 0) + sessionCounters.completedQty
      if (currentTotal >= workOrder.lotSize) {
        console.warn('[LiveView] submitDecision blocked: WO lot size reached', { currentTotal, lotSize: workOrder.lotSize })
        if (!completedWoData) {
          setCompletedWoData({
            woNumber: workOrder.woNumber, lotSize: workOrder.lotSize, completedQty: currentTotal,
            goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
            ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
            falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
          })
        }
        setWoCompleted(true)
        try { await handleStopProcess() } catch (e) { /* ignore */ }
        return
      }
    }

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

      // 2. Calculate false call (use effectiveInspection which includes captured data from modal)
      const isFalseCall = (effectiveInspection.decision === 'PASS' && operatorDecision === 'NG') ||
                         (effectiveInspection.decision === 'FAIL' && operatorDecision === 'GOOD')

      // Check for per-frame false calls (mixed scenario: overall NG but some frames are false calls)
      const hasPerFrameFalseCalls = falseCallData?.perFrameDecisions &&
        Object.values(falseCallData.perFrameDecisions).some(d => d && d !== 'REAL_NG')
      const shouldCreateOverride = isFalseCall || hasPerFrameFalseCalls

      console.log('[LiveView] False call check:', {
        aiDecision: effectiveInspection.decision,
        operatorDecision,
        isFalseCall,
        hasPerFrameFalseCalls,
        shouldCreateOverride,
        hasFalseCallRef: !!falseCallInspectionRef.current
      })

      // 2.1. Optimistic local counter update — instant UI feedback (real WO path)
      // Multi-cavity panels: 1 board confirmation = N PCBs (cavity_count)
      // Split GOOD vs NG based on per-PCB counts (TOP+BOTTOM same SN = 1 PCB)
      const qty = activeCavityCount
      const { goodQty: goodDelta, ngQty: ngDelta, falseCallCount } =
        computeCounterDeltas(qty, operatorDecision, falseCallData)
      if (fetchedWO) {
        setSessionCounters(prev => ({
          completedQty: prev.completedQty + qty,
          goodQty: prev.goodQty + goodDelta,
          ngQty: prev.ngQty + ngDelta,
          falseCallQty: shouldCreateOverride ? prev.falseCallQty + (falseCallCount || qty) : prev.falseCallQty,
        }))
        console.log('[LiveView] Optimistic counter update applied:', operatorDecision, `qty=${qty} good=${goodDelta} ng=${ngDelta} fc=${falseCallCount}`)
      }

      // 2.5. If false call (board-level OR per-frame): save images + create Override
      // Use captured inspection from modal open (falseCallInspectionRef) to prevent stale closure
      const inspectionForOverride = falseCallInspectionRef.current || activeInspection
      if (shouldCreateOverride && inspectionForOverride) {
        const boardId = `${workOrder.woNumber}-${String(boardSequenceRef.current + 1).padStart(4, '0')}`
        const overrideType = inspectionForOverride.decision === 'PASS' ? 'MISSED_DEFECT' : 'FALSE_POSITIVE'

        // Step 1: Save images to LOCAL storage (non-blocking — failure here must NOT prevent override creation)
        let localPaths = {}
        let frameDetails = null
        try {
          const uploadBody = {
            inspection: inspectionForOverride,
            workOrder,
            customerName: workOrder?.customer?.name || workOrder?.customerName || 'UNKNOWN',
            boardSequence: String(boardSequenceRef.current + 1).padStart(4, '0'),
            falseCallReason: falseCallData?.reason || 'UNSPECIFIED'
          }
          // Pass per-frame decisions for multi-frame false call metadata
          if (falseCallData?.perFrameDecisions) {
            uploadBody.perFrameDecisions = falseCallData.perFrameDecisions
          }
          const uploadResponse = await authFetch('/api/inspection/upload-false-call', {
            method: 'POST',
            body: JSON.stringify(uploadBody)
          })
          const uploadResult = await uploadResponse.json()
          localPaths = uploadResult.success ? uploadResult.paths : {}
          frameDetails = uploadResult.frameDetails || null
          console.log('[LiveView] Image upload:', uploadResult.success ? 'OK' : uploadResult.error,
            frameDetails ? `(${frameDetails.length} frame details)` : '')
        } catch (uploadErr) {
          console.warn('[LiveView] Image upload failed (continuing with override):', uploadErr.message)
        }

        // Step 2: Create Override record for Manager review (MUST always run)
        try {
          const overridePayload = {
            board_id: boardId,
            defect_type: overrideType,
            override_type: overrideType,
            reason: falseCallData?.reason || 'UNSPECIFIED',
            operator_notes: falseCallData?.notes || '',
            local_image_path: localPaths?.top?.[0]?.path || localPaths?.bottom?.[0]?.path || '',
            local_image_paths: JSON.stringify(localPaths),
          }

          // Only include optional fields if they have actual values
          // (null values cause Zod validation to fail — .optional() rejects null)
          // ng_frame_details must be conditional to avoid PostgREST error if column doesn't exist yet
          if (frameDetails) overridePayload.ng_frame_details = JSON.stringify(frameDetails)
          if (sectionId) overridePayload.section_id = sectionId
          if (lineId) overridePayload.line_id = lineId
          if (workOrder?.id) overridePayload.work_order_id = workOrder.id
          if (customerId) overridePayload.customer_id = customerId
          if (user?.id) overridePayload.operator_id = user.id
          if (user?.name) overridePayload.operator_name = user.name

          console.log('[LiveView] Creating override:', { boardId, overrideType, reason: overridePayload.reason })

          let overrideResponse = await authFetch('/api/overrides', {
            method: 'POST',
            body: JSON.stringify(overridePayload)
          })

          let overrideResult = await overrideResponse.json()

          // Retry without ng_frame_details if column doesn't exist yet (migration not run)
          if (!overrideResult.success && overrideResult.error?.includes('ng_frame_details')) {
            console.warn('[LiveView] ng_frame_details column missing, retrying without it')
            const { ng_frame_details, ...fallbackPayload } = overridePayload
            overrideResponse = await authFetch('/api/overrides', {
              method: 'POST',
              body: JSON.stringify(fallbackPayload)
            })
            overrideResult = await overrideResponse.json()
          }

          if (overrideResult.success) {
            console.log('[LiveView] Override created:', overrideResult.data?.id, overrideResult.duplicate ? '(duplicate)' : '')
            clearOverridesCache()
          } else {
            console.error('[LiveView] Override creation failed:', overrideResult.error, overrideResult.details)
          }
        } catch (overrideErr) {
          console.error('[LiveView] Override API error:', overrideErr.message)
        }

        // Clear captured inspection
        falseCallInspectionRef.current = null
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
          aiResult: effectiveInspection.decision === 'PASS' ? 'GOOD' : 'NG',
          aiConfidence: calculateAvgConfidence(effectiveInspection),
          operatorDecision,
          operatorId: user?.id,
          isFalseCall: shouldCreateOverride,
          falseCallReasonCode: falseCallData?.reason,
          plcSignalSent: operatorDecision,
          shift: getCurrentShift(),
          defectCount: getTotalDefects(effectiveInspection),
          imageTopUrl: effectiveInspection.results?.top?.image_url,
          imageBottomUrl: effectiveInspection.results?.bottom?.image_url,
        }

        try {
          await saveInspection(inspectionData)
        } catch (dbError) {
          console.warn('[LiveView] Save inspection failed (Supabase not configured?):', dbError)
        }

        // 4. Update WO counters in DB (cavity_count PCBs per board)
        // Uses per-frame split computed earlier (goodDelta/ngDelta)
        const counterUpdate = {
          goodQty: goodDelta,
          ngQty: ngDelta,
          completedQty: qty,
        }
        if (shouldCreateOverride) {
          counterUpdate.falseCallQty = falseCallCount || qty
        }

        let wasAutoCompleted = false
        try {
          const counterResult = await updateCounters(workOrder.id, counterUpdate)
          console.log('[LiveView] Counter update:', counterResult?.success ? 'OK' : counterResult?.error)
          wasAutoCompleted = counterResult?.autoCompleted === true
        } catch (dbError) {
          console.warn('[LiveView] Update counters failed:', dbError)
        }

        // 6. Refresh WO data from DB (await to ensure stats update in UI)
        try {
          await refreshWO()
        } catch (refreshErr) {
          console.warn('[LiveView] WO refresh failed:', refreshErr)
        }

        // 7. Auto-stop machine if WO was completed (lot size reached)
        // Check BOTH server auto-complete flag AND client-side session counters.
        // Session counter check is critical: if some DB counter updates were lost or
        // delayed, the server might not detect lot_size reached, but the client knows
        // the real count from optimistic updates.
        if (!wasAutoCompleted && workOrder.lotSize > 0) {
          const effectiveTotal = (workOrder.completedQty || 0) + sessionCounters.completedQty
          if (effectiveTotal >= workOrder.lotSize) {
            console.log('[LiveView] Client-side lot size reached:', effectiveTotal, '>=', workOrder.lotSize)
            wasAutoCompleted = true
          }
        }
        if (wasAutoCompleted) {
          console.log('[LiveView] WO auto-completed — stopping machine')
          // Capture final WO data before fetchedWO becomes null
          const finalCompleted = (workOrder.completedQty || 0) + sessionCounters.completedQty
          setCompletedWoData({
            woNumber: workOrder.woNumber,
            lotSize: workOrder.lotSize,
            completedQty: finalCompleted,
            goodQty: (workOrder.goodQty || 0) + sessionCounters.goodQty,
            ngQty: (workOrder.ngQty || 0) + sessionCounters.ngQty,
            falseCallQty: (workOrder.falseCallQty || 0) + sessionCounters.falseCallQty,
          })
          setWoCompleted(true)
          try {
            await handleStopProcess()
          } catch (stopErr) {
            console.warn('[LiveView] Auto-stop failed:', stopErr)
          }
        }
      } else if (BYPASS_WO_CHECK) {
        // Mock WO: update counters locally in state (cavity_count PCBs per board)
        setMockWorkOrder(prev => ({
          ...prev,
          completedQty: prev.completedQty + qty,
          goodQty: operatorDecision === 'GOOD' ? prev.goodQty + qty : prev.goodQty,
          ngQty: operatorDecision === 'NG' ? prev.ngQty + qty : prev.ngQty,
          falseCallQty: shouldCreateOverride ? prev.falseCallQty + qty : prev.falseCallQty,
        }))
      }

      console.log('[LiveView] Decision submitted:', { operatorDecision, isFalseCall, shouldCreateOverride })

    } catch (error) {
      console.error('[LiveView] Submit decision error:', error)
    } finally {
      // Always increment sequence — even if confirmInspection or DB save threw.
      // Skipping this causes the next board to reuse the same board_id → duplicate.
      boardSequenceRef.current += 1

      // Reset dev mock if used
      if (devMockInspection) {
        setDevMockInspection(null)
        setDevMockStage({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
          totalStages: 0,
          icon: 'hourglass'
        })
      }

      // Release serialization lock and process queued call
      isSubmittingRef.current = false
      const queued = pendingSubmitRef.current
      if (queued) {
        pendingSubmitRef.current = null
        // Use setTimeout(0) to avoid deep recursion in the call stack
        setTimeout(() => submitDecision(queued.operatorDecision, queued.falseCallData), 0)
      }
    }
  }, [activeInspection, workOrder, fetchedWO, currentInspection, confirmInspection,
      lineId, sectionId, customerId, user, updateCounters, refreshWO, devMockInspection, activeCavityCount,
      sessionCounters.completedQty, handleStopProcess])

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
      // Capture inspection data NOW so it's available even if SSE clears currentInspection
      falseCallInspectionRef.current = activeInspection
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
      // Capture inspection data NOW so it's available even if SSE clears currentInspection
      falseCallInspectionRef.current = activeInspection
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

  /**
   * Handle cavity overlay NG confirmation (Real NG or mixed NG+false calls)
   * @param {Object} info - { reason?, decisions?, pcbCounts }
   */
  const handleCavityConfirmNG = useCallback(async (info) => {
    setShowCavityOverlay(false)
    if (info?.reason) {
      // Mixed: some false calls + some real NG → pass per-frame decisions for override + counter splitting
      await submitDecision('NG', {
        reason: info.reason,
        notes: '',
        perFrameDecisions: info.decisions,
        pcbCounts: info.pcbCounts,
      })
    } else {
      // Pure NG: all frames confirmed as real NG — still pass pcbCounts for accurate counting
      await submitDecision('NG', info?.pcbCounts ? { pcbCounts: info.pcbCounts } : null)
    }
  }, [submitDecision])

  /**
   * Handle cavity overlay GOOD confirmation (False Call)
   */
  const handleCavityConfirmGood = useCallback(async (reason, decisions, pcbCounts) => {
    setShowCavityOverlay(false)
    await submitDecision('GOOD', { reason, notes: '', perFrameDecisions: decisions || null, pcbCounts: pcbCounts || null })
  }, [submitDecision])

  // ============================================
  // Inline NG Frame Review (Manual Mode)
  // ============================================

  const completeInlineReview = useCallback(async (allDecisions) => {
    const hasRealNG = Object.values(allDecisions).some(d => d === 'REAL_NG')
    const hasFalseCall = Object.values(allDecisions).some(d => d && d !== 'REAL_NG')
    const firstReason = Object.values(allDecisions).find(d => d && d !== 'REAL_NG') || ''
    // Compute per-PCB counts (TOP+BOTTOM with same SN = 1 PCB)
    // Pass frame layout so computePcbCounts can correctly group frames when serial_number is null
    const inspection = activeInspection || falseCallInspectionRef.current
    const frameLayout = {
      cavityCount: activeCavityCount,
      topFrameCount: activeTopFrameCount || inspection?.results?.top?.length || 0,
      bottomFrameCount: activeBottomFrameCount || inspection?.results?.bottom?.length || 0,
    }
    const pcbCounts = ngFrameReview ? computePcbCounts(ngFrameReview.frames, allDecisions, frameLayout) : null
    setNgFrameReview(null)
    setInlineReasonInput(false)
    setInlineSelectedReason('')
    if (hasRealNG) {
      await submitDecision('NG', hasFalseCall
        ? { reason: firstReason, notes: '', perFrameDecisions: allDecisions, pcbCounts }
        : { pcbCounts })
    } else {
      await submitDecision('GOOD', { reason: firstReason, notes: '', perFrameDecisions: allDecisions, pcbCounts })
    }
  }, [submitDecision, ngFrameReview])

  const handleInlineFrameNG = useCallback(() => {
    if (!ngFrameReview) return
    const frame = ngFrameReview.frames[ngFrameReview.currentIndex]
    if (!frame) return

    const key = `${frame.side}-${frame.frameIndex}`
    const newDecisions = { ...ngFrameReview.decisions, [key]: 'REAL_NG' }

    const nextIdx = findNextUnreviewedFrame(ngFrameReview.frames, newDecisions, ngFrameReview.currentIndex + 1)
    if (nextIdx === -1) {
      completeInlineReview(newDecisions)
    } else {
      setNgFrameReview(prev => ({ ...prev, currentIndex: nextIdx, decisions: newDecisions }))
    }
    setInlineReasonInput(false)
    setInlineSelectedReason('')
  }, [ngFrameReview, completeInlineReview])

  const handleInlineFrameGood = useCallback(() => {
    const effectiveReason = inlineSelectedReason === 'other' ? inlineOtherText.trim() : inlineSelectedReason.trim()
    if (!ngFrameReview || !effectiveReason) return
    const frame = ngFrameReview.frames[ngFrameReview.currentIndex]
    if (!frame) return

    const key = `${frame.side}-${frame.frameIndex}`
    const newDecisions = { ...ngFrameReview.decisions, [key]: effectiveReason }

    const nextIdx = findNextUnreviewedFrame(ngFrameReview.frames, newDecisions, ngFrameReview.currentIndex + 1)
    if (nextIdx === -1) {
      completeInlineReview(newDecisions)
    } else {
      setNgFrameReview(prev => ({ ...prev, currentIndex: nextIdx, decisions: newDecisions }))
    }
    setInlineReasonInput(false)
    setInlineSelectedReason('')
    setInlineOtherText('')
  }, [ngFrameReview, inlineSelectedReason, inlineOtherText, completeInlineReview])

  /**
   * Handle NG thumbnail click in manual mode → open CavityReviewOverlay at that frame
   */
  const handleNGFrameClick = useCallback((frame, index, side) => {
    if (!ngFrameReview || !frame || frame.label != true) return
    // Find this frame's index in the ngFrameReview.frames array
    const reviewIdx = ngFrameReview.frames.findIndex(
      f => f.side === side && f.frameIndex === index
    )
    if (reviewIdx >= 0) {
      setCavityInitialIndex(reviewIdx)
      setShowCavityOverlay(true)
    }
  }, [ngFrameReview])

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
      // When CavityReviewOverlay is open, it handles its own per-frame
      // auto-NG countdown. Don't run a competing timer here.
      if (showCavityOverlay) return

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
  }, [aiResult, isPaused, isOperator, activeInspection, submitDecision, autoNgEnabled, showCavityOverlay])

  // ============================================
  // Dev Mode: Simulate Inspection
  // ============================================

  const simulateInspection = useCallback(async (result) => {
    if (!workOrder || activeInspection) return

    // Simulate stages (generic dual-side flow for dev mode)
    const stages = ['board_incoming', 'capture_top', 'pcb_flipping', 'capture_bottom', 'done']

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      setDevMockStage({
        status: stage === 'done' ? 'ready' : 'processing',
        stageName: stage,
        message: stage === 'done' ? 'Ready for review' :
                 stage === 'pcb_flipping' ? 'Flipping PCB...' :
                 `Processing ${stage}...`,
        stageIndex: i + 1,
        totalStages: stages.length,
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
      if (showCavityOverlay) return // Don't intercept keys while CavityReviewOverlay is open (reason input etc.)
      if (inlineReasonInput) return // Don't intercept keys while typing reason
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
  }, [isOperator, isConfirming, showFalseCallModal, showCavityOverlay, inlineReasonInput, activeInspection, workOrder,
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
    // Handle array of frames structure — only count objects with label=1 or label=true
    const isDefect = (obj) => obj.label === 1 || obj.label === true
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []

    const topCount = topFrames.reduce((sum, f) => sum + (f.objects || []).filter(isDefect).length, 0)
    const bottomCount = bottomFrames.reduce((sum, f) => sum + (f.objects || []).filter(isDefect).length, 0)
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
          <AlertTriangle className="w-16 h-16 text-phosphor-teal mx-auto mb-4" />
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
              className="px-6 py-3 border border-phosphor-teal text-phosphor-teal font-display font-bold tracking-wider hover:bg-phosphor-teal/10 transition-all"
            >
              REFRESH
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Actions disabled? Enable when AI FAIL (NG) or inline frame review active
  const inlineReviewActive = !!ngFrameReview && ngFrameReview.frames.length > 0
  const actionsDisabled = !isOperator || isConfirming || isPaused || !activeInspection || (aiResult !== 'NG' && !inlineReviewActive)

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
            className="p-2 border border-surface-border text-text-secondary hover:border-phosphor-teal/50 hover:text-phosphor-teal transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-phosphor-teal flex items-center justify-center bg-terminal">
              <span className="font-display font-bold text-lg text-phosphor-teal">IN</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-wider text-text-primary">
                {lineName || `Line ${lineId}`}
                {(customerName || workOrder?.customer?.name || workOrder?.customerName) && (
                  <span className="text-phosphor-cyan ml-2">- {customerName || workOrder?.customer?.name || workOrder?.customerName}</span>
                )}
              </h1>
              <p className="font-mono text-xxs text-phosphor-teal tracking-widest">
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
                : "bg-phosphor-teal/10 border-phosphor-teal/50"
            )}>
              <span className={cn(
                "font-mono text-sm",
                reviewCountdown <= 5 ? "text-phosphor-red" : "text-phosphor-teal"
              )}>Auto NG in</span>
              <span className={cn(
                "font-mono text-2xl font-bold",
                reviewCountdown <= 5 ? "text-phosphor-red" : "text-phosphor-teal"
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

          <span className="font-mono text-sm text-phosphor-teal">{currentTime}</span>

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
          {/* RUN Button — NOT disabled when woCompleted/woOnHold so user can click and see a toast message */}
          <button
            onClick={handleRunProcess}
            disabled={!isOperator || !isConnected || isControlling || effectiveProcessStatus === 'RUNNING'}
            className={cn(
              "h-10 px-4 flex items-center gap-2 border-2 transition-all",
              "font-display text-xs font-bold tracking-wider",
              effectiveProcessStatus === 'RUNNING'
                ? "bg-phosphor-green border-phosphor-green text-void"
                : isOperator && isConnected && effectiveProcessStatus !== 'RUNNING' && !woCompleted && !woOnHold
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
                ? "bg-phosphor-teal border-phosphor-teal text-void"
                : isOperator && isConnected && effectiveProcessStatus === 'RUNNING'
                  ? "border-phosphor-teal text-phosphor-teal hover:bg-phosphor-teal hover:text-void"
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

          {/* START blocked toast — appears inline next to buttons */}
          {startBlockReason && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-teal/15 border border-phosphor-teal/40 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-phosphor-teal flex-shrink-0" />
              <span className="font-mono text-xs text-phosphor-teal leading-tight">{startBlockReason}</span>
              <button onClick={() => setStartBlockReason(null)} className="text-phosphor-teal/60 hover:text-phosphor-teal ml-1 flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
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
                    availableModels.map(model => {
                      const isWoBoard = workOrder?.board?.name === model.name
                      const isDisabled = model.name === currentModel || !isWoBoard
                      return (
                        <button
                          key={model.id}
                          onClick={() => !isDisabled && handleModelSwitch(model.name)}
                          disabled={isDisabled}
                          className={cn(
                            "w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors",
                            model.name === currentModel
                              ? "bg-purple-500/10 border-l-2 border-l-purple-400"
                              : isWoBoard
                                ? "hover:bg-surface-border/30 border-l-2 border-l-transparent"
                                : "opacity-40 cursor-not-allowed border-l-2 border-l-transparent"
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
                            <div className="flex items-center gap-2">
                              {model.customer?.name && (
                                <span className="font-mono text-[10px] text-text-tertiary">
                                  {model.customer.name}
                                </span>
                              )}
                              {isWoBoard && workOrder?.lotSize > 0 ? (
                                <span className="font-mono text-[10px] text-phosphor-green">
                                  {workOrder.lotSize - (workOrder.completedQty || 0)} remaining
                                </span>
                              ) : !isWoBoard && (
                                <span className="font-mono text-[10px] text-phosphor-red">No WO</span>
                              )}
                            </div>
                          </div>
                          {model.name === currentModel && (
                            <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          )}
                        </button>
                      )
                    })
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
                  ? "border-phosphor-teal bg-phosphor-teal/10" 
                  : "border-surface-border bg-surface-border/10",
                "hover:border-text-tertiary"
              )}
              title={effectiveAutoNgEnabled ? "Auto-NG ON: Will auto-reject after 15s" : "Auto-NG OFF: Manual confirmation required"}
            >
              {effectiveAutoNgEnabled ? (
                <ToggleRight className="w-4 h-4 text-phosphor-teal" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-text-tertiary" />
              )}
              <span className={cn(
                "font-mono text-xs font-bold",
                effectiveAutoNgEnabled ? "text-phosphor-teal" : "text-text-tertiary"
              )}>
                AUTO-NG
              </span>
            </button>
          ) : (
            /* Manager: Read-only indicator */
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 border",
              effectiveAutoNgEnabled 
                ? "border-phosphor-teal bg-phosphor-teal/10" 
                : "border-surface-border bg-surface-border/10"
            )}>
              {effectiveAutoNgEnabled ? (
                <ToggleRight className="w-4 h-4 text-phosphor-teal" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-text-tertiary" />
              )}
              <span className={cn(
                "font-mono text-xs font-bold",
                effectiveAutoNgEnabled ? "text-phosphor-teal" : "text-text-tertiary"
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
              onFrameClick={inlineReviewActive ? handleNGFrameClick : undefined}
              reviewingFrameKey={inlineReviewActive && ngFrameReview?.frames[ngFrameReview.currentIndex]
                ? `${ngFrameReview.frames[ngFrameReview.currentIndex].side}-${ngFrameReview.frames[ngFrameReview.currentIndex].frameIndex}`
                : undefined}
              frameDecisions={ngFrameReview?.decisions}
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

      {/* NG Frame Review Notice — above footer to avoid crowding buttons */}
      {inlineReviewActive && (() => {
        const curFrame = ngFrameReview.frames[ngFrameReview.currentIndex]
        const reviewedCount = Object.keys(ngFrameReview.decisions).length
        return (
          <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-1.5 bg-phosphor-red/10 border-t border-phosphor-red/30">
            <span className="font-mono text-sm text-phosphor-red font-bold">
              NG Frame {ngFrameReview.currentIndex + 1}/{ngFrameReview.frames.length}
            </span>
            <span className="font-mono text-xs text-text-tertiary">
              {curFrame?.side} #{(curFrame?.frameIndex || 0) + 1}
            </span>
            {reviewedCount > 0 && (
              <span className="font-mono text-xs text-text-tertiary">
                ({reviewedCount}/{ngFrameReview.frames.length} reviewed)
              </span>
            )}
          </div>
        )
      })()}

      {/* ============ FOOTER: ACTIONS ============ */}
      <footer className="flex-shrink-0 bg-panel border-t border-surface-border flex flex-col md:flex-row md:items-center md:justify-between px-2 md:px-4 py-1.5 md:py-0 md:h-28 gap-1 md:gap-0">
        {/* Left: WO Stats */}
        <div className="flex items-center justify-center md:justify-start">
          {effectiveCounters && (
            <div className="flex items-center gap-2 md:gap-3 lg:gap-4 xl:gap-6 px-2 md:px-3 lg:px-4 py-1.5 md:py-2 bg-terminal border border-surface-border">
              <div className="flex items-center gap-1 md:gap-2">
                <span className="font-mono text-xs text-text-tertiary hidden md:inline">PROGRESS</span>
                <span className="font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold text-phosphor-teal">
                  {effectiveCounters.completedQty}/{effectiveCounters.lotSize}
                </span>
              </div>
              <div className="w-px h-6 md:h-8 bg-surface-border" />
              <div className="flex items-center gap-1 md:gap-2">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-phosphor-green" />
                <span className="font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold text-phosphor-green">{effectiveCounters.goodQty}</span>
              </div>
              <div className="w-px h-6 md:h-8 bg-surface-border" />
              <div className="flex items-center gap-1 md:gap-2">
                <XCircle className="w-4 h-4 md:w-5 md:h-5 text-phosphor-red" />
                <span className="font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold text-phosphor-red">{effectiveCounters.ngQty}</span>
              </div>
              <div className="w-px h-6 md:h-8 bg-surface-border" />
              <div className="flex items-center gap-1 md:gap-2">
                <span className="font-mono text-xs text-text-tertiary hidden md:inline">YIELD</span>
                <span className={cn(
                  "font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold",
                  parseFloat(yieldPercent) >= 98 ? "text-phosphor-green" :
                  parseFloat(yieldPercent) >= 95 ? "text-phosphor-teal" : "text-phosphor-red"
                )}>
                  {yieldPercent}%
                </span>
              </div>
              {/* Cycle Time */}
              {effectiveCycleTime != null && (
                <>
                  <div className="w-px h-6 md:h-8 bg-surface-border" />
                  <div className="flex items-center gap-1 md:gap-2">
                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-phosphor-cyan" />
                    <span className="font-mono text-xs text-text-tertiary hidden md:inline">CYCLE/PCB</span>
                    <span className="font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold text-phosphor-cyan">
                      {effectiveCycleTime}s
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center justify-center gap-2 md:gap-4">
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

          {/* Inline NG Frame Review (Manual Mode) */}
          {inlineReviewActive && !inlineReasonInput ? (() => {
            const curFrame = ngFrameReview.frames[ngFrameReview.currentIndex]
            const curKey = curFrame ? `${curFrame.side}-${curFrame.frameIndex}` : ''
            const curDecision = ngFrameReview.decisions[curKey]
            const isAlreadyReviewed = curDecision != null
            const reviewedCount = Object.keys(ngFrameReview.decisions).length

            return (
              <>
                {isAlreadyReviewed ? (
                  /* Already reviewed — show decision badge */
                  <div className={cn(
                    "h-20 px-6 md:px-10 flex items-center gap-2 md:gap-3 border-4",
                    curDecision === 'REAL_NG'
                      ? "border-phosphor-red/60 bg-phosphor-red/10"
                      : "border-phosphor-green/60 bg-phosphor-green/10"
                  )}>
                    {curDecision === 'REAL_NG' ? (
                      <AlertCircle className="w-6 h-6 md:w-7 md:h-7 text-phosphor-red" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-phosphor-green" />
                    )}
                    <span className={cn(
                      "font-display text-lg md:text-xl font-bold",
                      curDecision === 'REAL_NG' ? "text-phosphor-red" : "text-phosphor-green"
                    )}>
                      {curDecision === 'REAL_NG' ? 'Confirmed NG' : `False Call`}
                    </span>
                  </div>
                ) : (
                  /* Not yet reviewed — GOOD/NG buttons */
                  <>
                    <button
                      onClick={() => setInlineReasonInput(true)}
                      disabled={isConfirming}
                      className="h-20 px-6 md:px-8 lg:px-10 xl:px-14 flex items-center gap-2 md:gap-4 border-4 transition-all font-display text-lg md:text-xl xl:text-2xl font-bold tracking-wider bg-phosphor-green/10 border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void hover:shadow-glow-green"
                    >
                      <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 xl:w-8 xl:h-8" />
                      <span>GOOD</span>
                      <span className="font-mono text-xs md:text-sm opacity-60">(G)</span>
                    </button>

                    <button
                      onClick={handleInlineFrameNG}
                      disabled={isConfirming}
                      className="h-20 px-6 md:px-8 lg:px-10 xl:px-14 flex items-center gap-2 md:gap-4 border-4 transition-all font-display text-lg md:text-xl xl:text-2xl font-bold tracking-wider bg-phosphor-red/10 border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void hover:shadow-glow-red"
                    >
                      <XCircle className="w-6 h-6 md:w-7 md:h-7 xl:w-8 xl:h-8" />
                      <span>NG</span>
                      <span className="font-mono text-xs md:text-sm opacity-60">(N)</span>
                    </button>
                  </>
                )}
              </>
            )
          })() : inlineReviewActive && inlineReasonInput ? (
            /* Inline reason input for false call */
            <div className="flex items-center gap-4">
              {inlineSelectedReason === 'other' ? (
                <div className="flex items-center gap-2 min-w-[200px]">
                  <button
                    onClick={() => { setInlineSelectedReason(''); setInlineOtherText('') }}
                    className="h-14 px-3 bg-elevated border border-surface-border text-text-secondary font-mono hover:border-phosphor-teal/50 transition-colors flex-shrink-0"
                  >
                    &larr;
                  </button>
                  <input
                    type="text"
                    value={inlineOtherText}
                    onChange={(e) => setInlineOtherText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleInlineFrameGood() }}
                    placeholder="Type other reason..."
                    autoFocus
                    className="h-14 px-4 bg-elevated border border-surface-border text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-phosphor-green min-w-[200px] flex-1"
                  />
                </div>
              ) : (
                <select
                  value={inlineSelectedReason}
                  onChange={(e) => { setInlineSelectedReason(e.target.value); setInlineOtherText('') }}
                  autoFocus
                  className="h-14 px-4 bg-elevated border border-surface-border text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-phosphor-green min-w-[200px]"
                >
                  <option value="">Select reason...</option>
                  {falseCallReasons
                    .filter(r => !(r.name || r).toLowerCase().includes('other'))
                    .map(r => (
                      <option key={r.id || r} value={r.name || r}>{r.name || r}</option>
                    ))}
                  <option value="other">Other</option>
                </select>
              )}
              <button
                onClick={handleInlineFrameGood}
                disabled={inlineSelectedReason === 'other' ? !inlineOtherText.trim() : !inlineSelectedReason.trim()}
                className="h-14 px-8 bg-phosphor-green text-void font-display font-bold text-lg hover:bg-phosphor-green-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                SUBMIT
              </button>
              <button
                onClick={() => { setInlineReasonInput(false); setInlineSelectedReason(''); setInlineOtherText('') }}
                className="h-14 px-6 bg-elevated border border-surface-border text-text-secondary font-display font-bold hover:border-phosphor-teal/50 transition-colors"
              >
                CANCEL
              </button>
            </div>
          ) : (
            /* Default GOOD/NG Buttons (non-review mode) */
            <>
              {/* GOOD Button - Large for glove operation (min 30mm / h-20=80px) */}
              <button
                onClick={handleGoodClick}
                disabled={actionsDisabled}
                className={cn(
                  "h-20 px-6 md:px-8 lg:px-10 xl:px-14 flex items-center gap-2 md:gap-4 border-4 transition-all",
                  "font-display text-lg md:text-xl xl:text-2xl font-bold tracking-wider",
                  actionsDisabled
                    ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                    : "bg-phosphor-green/10 border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void hover:shadow-glow-green"
                )}
              >
                <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 xl:w-8 xl:h-8" />
                <span>GOOD</span>
                <span className="font-mono text-xs md:text-sm opacity-60">(G)</span>
              </button>

              {/* NG Button - Large for glove operation (min 30mm / h-20=80px) */}
              <button
                onClick={handleNGClick}
                disabled={actionsDisabled}
                className={cn(
                  "h-20 px-6 md:px-8 lg:px-10 xl:px-14 flex items-center gap-2 md:gap-4 border-4 transition-all",
                  "font-display text-lg md:text-xl xl:text-2xl font-bold tracking-wider",
                  actionsDisabled
                    ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                    : "bg-phosphor-red/10 border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void hover:shadow-glow-red"
                )}
              >
                <XCircle className="w-6 h-6 md:w-7 md:h-7 xl:w-8 xl:h-8" />
                <span>NG</span>
                <span className="font-mono text-xs md:text-sm opacity-60">(N)</span>
              </button>
            </>
          )}
        </div>
      </footer>

      {/* ============ MODALS & OVERLAYS ============ */}

      {/* Cavity Review Overlay (multi-cavity per-PCB confirmation) */}
      {showCavityOverlay && currentInspection && isOperator && (
        <CavityReviewOverlay
          inspection={currentInspection}
          queuePosition={panelProgress.confirmed + 1}
          queueTotal={panelProgress.total || panelProgress.confirmed + 1 + queueLength}
          autoNgEnabled={autoNgEnabled}
          onConfirmNG={handleCavityConfirmNG}
          onConfirmGood={handleCavityConfirmGood}
          onClose={() => setShowCavityOverlay(false)}
          falseCallReasons={falseCallReasons}
          initialFrameIndex={cavityInitialIndex}
          initialDecisions={ngFrameReview?.decisions || {}}
          cavityCount={activeCavityCount}
          topFrameCount={activeTopFrameCount}
          bottomFrameCount={activeBottomFrameCount}
          onDecisionChange={(key, value) => {
            setNgFrameReview(prev => prev ? {
              ...prev,
              decisions: { ...prev.decisions, [key]: value }
            } : prev)
          }}
        />
      )}

      {/* False Call Modal (legacy single-board flow) */}
      <FalseCallModal
        isOpen={showFalseCallModal}
        onClose={() => {
          setShowFalseCallModal(false)
          setPendingDecision(null)
          falseCallInspectionRef.current = null
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

      {/* WO Completed Overlay */}
      {woOnHold && !woCompleted && (
        <div className="fixed inset-0 z-50 bg-void/90 flex items-center justify-center">
          <div className="bg-panel border-2 border-phosphor-teal p-8 max-w-lg text-center space-y-6">
            <Pause className="w-16 h-16 text-phosphor-teal mx-auto" />
            <h2 className="font-display text-3xl font-bold text-phosphor-teal tracking-wide">
              WORK ORDER ON HOLD
            </h2>
            <div className="space-y-2">
              <p className="font-mono text-lg text-text-primary">
                {workOrder?.woNumber || 'WO'}
              </p>
              <p className="font-mono text-sm text-text-secondary">
                Work Order tidak aktif atau sedang di-hold. Mesin tidak dapat dijalankan.
              </p>
            </div>
            <div className="pt-4 border-t border-surface-border space-y-3">
              <p className="font-mono text-sm text-text-tertiary">
                Hubungi supervisor untuk mengaktifkan kembali Work Order.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setWoOnHold(false); refreshWO(); }}
                  className="px-6 py-3 border-2 border-phosphor-teal text-phosphor-teal font-display font-bold tracking-wider hover:bg-phosphor-teal hover:text-void transition-all"
                >
                  REFRESH STATUS
                </button>
                <button
                  onClick={() => router.push('/inspection/select-line')}
                  className="px-6 py-3 bg-surface-border text-text-secondary font-display font-bold tracking-wider hover:bg-elevated transition-all"
                >
                  BACK TO LINE SELECT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {woCompleted && (() => {
        // Use captured WO data (frozen at completion time) to avoid mock WO fallback showing wrong numbers
        const modalData = completedWoData || effectiveCounters
        const modalYield = modalData?.completedQty > 0
          ? ((modalData.goodQty / modalData.completedQty) * 100).toFixed(1)
          : '0.0'
        return (
          <div className="fixed inset-0 z-50 bg-void/90 flex items-center justify-center">
            <div className="bg-panel border-2 border-phosphor-green p-8 max-w-lg text-center space-y-6">
              <CheckCircle2 className="w-16 h-16 text-phosphor-green mx-auto" />
              <h2 className="font-display text-3xl font-bold text-phosphor-green tracking-wide">
                WORK ORDER COMPLETED
              </h2>
              <div className="space-y-2">
                <p className="font-mono text-lg text-text-primary">
                  {modalData?.woNumber || workOrder?.woNumber || 'WO'}
                </p>
                <p className="font-mono text-sm text-text-secondary">
                  {modalData?.completedQty?.toLocaleString() || 0} / {modalData?.lotSize?.toLocaleString() || 0} units completed
                </p>
                <p className="font-mono text-sm text-text-tertiary">
                  GOOD: {modalData?.goodQty?.toLocaleString() || 0} | NG: {modalData?.ngQty?.toLocaleString() || 0} | Yield: {modalYield}%
                </p>
              </div>
              <div className="pt-4 border-t border-surface-border space-y-3">
                <p className="font-mono text-sm text-phosphor-teal">
                  Machine has been stopped. Please assign a new Work Order to continue.
                </p>
                <button
                  onClick={() => {
                    woCompletedDismissedRef.current = true
                    setWoCompleted(false)
                    setCompletedWoData(null)
                    clearActiveLine()
                    router.push('/inspection/select-line')
                  }}
                  className="px-8 py-3 bg-phosphor-teal text-void font-display font-bold text-lg tracking-wider hover:shadow-glow-teal transition-all cursor-pointer"
                >
                  SELECT NEW WORK ORDER
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default LiveViewV3

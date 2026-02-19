/**
 * useLiveInspection Hook
 * Manages SSE connection to AI Backend and inspection state
 * 
 * Flow:
 * 1. Connect SSE when WO is ready
 * 2. Listen for hardware_status, running_status, inspection events
 * 3. Display loading during capture/processing stages
 * 4. Display dual-side images when inspection event arrives
 * 5. Operator confirms (local only - no backend /confirm endpoint)
 * 6. Reset and wait for next inspection
 * 
 * @module hooks/useLiveInspection
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createAiBackendService,
  startInspection,
  pauseInspection,
  resumeInspection,
  stopInspection,
  selectModel,
  checkHealth,
  getStages,
  calculateFalseCall,
  resetSimSerial,
  triggerSimReady
} from '@/lib/services/aiBackendService'

// Stage definitions are fetched dynamically from GET /model/stages.
// Different models may have different stage counts (e.g., 4, 7, 11, 27).
// Empty default — actual stages populated by fetchStages() on connect.
const DEFAULT_STAGES = []

// Stage message map (legacy fallback)
const STAGE_MESSAGES = {
  'idle': 'Waiting for board...',
  'start': 'Board incoming...',
  'board_incoming': 'Board incoming...',
  'position_1': 'Camera Position 1...',
  'position_2': 'Camera Position 2...',
  'position_3': 'Camera Position 3...',
  'position_4': 'Camera Position 4...',
  'position_5': 'Camera Position 5...',
  'position_6': 'Camera Position 6...',
  'flip': 'Flipping PCB...',
  'pcb_flipping': 'Flipping PCB...',
  'running': 'Processing...',
  'done': 'Ready for review'
}

/**
 * useLiveInspection Hook
 * 
 * @param {string} lineId - Line ID
 * @param {object} workOrder - Active work order object
 * @param {object} options - Hook options
 * @returns {object} - Hook state and methods
 */
export function useLiveInspection(lineId, workOrder, options = {}) {
  const {
    autoConnect = true,
    modelName,
    onInspectionComplete,
    onError
  } = options

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [aiBackendAvailable, setAiBackendAvailable] = useState(null)

  // Hardware status
  const [hardwareStatus, setHardwareStatus] = useState({
    cameras: [],
    plcs: [],
    timestamp: null
  })

  // Stage definitions (fetched from /stages)
  const [stageDefinitions, setStageDefinitions] = useState(DEFAULT_STAGES)

  // Computed total stages
  const totalStages = stageDefinitions.length

  // Inspection stage (for loading UI)
  const [inspectionStage, setInspectionStage] = useState({
    status: 'idle',  // 'idle' | 'capturing' | 'processing' | 'ready'
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    motionStageIndex: 0,  // Independent PLC motion track progress
    visionStageIndex: 0,  // Independent AI vision track progress
    totalStages: DEFAULT_STAGES.length,
    icon: 'hourglass'
  })

  // Current inspection data (from SSE inspection event)
  const [currentInspection, setCurrentInspection] = useState(null)
  // Ref mirrors state for stale-closure-safe reads inside SSE callbacks.
  // Without this, handleInspection (registered once during connect()) always
  // sees currentInspection=null from its initial closure, so every incoming
  // event immediately dequeues instead of being queued.
  const currentInspectionRef = useRef(null)

  // Inspection queue for multi-cavity panels (rapid-fire SSE events)
  const inspectionQueueRef = useRef([])
  const [queueLength, setQueueLength] = useState(0)
  const [panelProgress, setPanelProgress] = useState({
    total: 0,       // total PCBs received in this panel cycle
    confirmed: 0,   // PCBs already confirmed
    good: 0,
    ng: 0,
  })

  // Session state
  const [sessionStatus, setSessionStatus] = useState(null)
  const [processStatus, setProcessStatus] = useState('IDLE') // IDLE | READY | RUNNING | PAUSED | STOPPED
  const [isControlling, setIsControlling] = useState(false) // Loading state for process control

  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false)
  const [lastConfirmation, setLastConfirmation] = useState(null)

  // Service reference
  const serviceRef = useRef(null)
  const sessionStartedRef = useRef(false)
  const stageDefinitionsRef = useRef(DEFAULT_STAGES) // Track latest stageDefinitions
  const isRunningProcessRef = useRef(false) // Synchronous guard for runProcess (state is batched, refs are immediate)

  // Keep refs in sync with state
  useEffect(() => {
    stageDefinitionsRef.current = stageDefinitions
  }, [stageDefinitions])

  useEffect(() => {
    currentInspectionRef.current = currentInspection
  }, [currentInspection])

  // ============================================
  // Check AI Backend Health
  // ============================================
  
  const checkAiBackend = useCallback(async () => {
    const healthy = await checkHealth()
    setAiBackendAvailable(healthy)
    
    if (!healthy) {
      setConnectionError('AI Backend tidak tersedia. Pastikan Auto Inspect Edge berjalan di port 8002')
    }
    
    return healthy
  }, [])

  // ============================================
  // Fetch Stage Definitions
  // ============================================

  const fetchStages = useCallback(async () => {
    try {
      const result = await getStages()
      if (result.success && result.data?.stages?.length > 0) {
        console.log('[LiveInspection] Stages loaded:', result.data.stages)
        setStageDefinitions(result.data.stages)
        // Update totalStages in current inspectionStage
        setInspectionStage(prev => ({
          ...prev,
          totalStages: result.data.stages.length
        }))
      }
    } catch (error) {
      console.warn('[LiveInspection] Failed to fetch stages, using defaults:', error)
    }
  }, [])

  // ============================================
  // Start Session
  // ============================================

  const initSession = useCallback(async () => {
    if (!workOrder || sessionStartedRef.current) return false

    // Model selection is handled by startInspection() which passes model_id
    // to the AI Backend. No separate selectModel() call needed here.
    console.log('[LiveInspection] Session ready, model:', modelName || '(auto)')
    sessionStartedRef.current = true
    setProcessStatus('READY')
    return true
  }, [workOrder, modelName])

  // ============================================
  // SSE Event Handlers
  // ============================================

  const handleConnected = useCallback((data) => {
    console.log('[LiveInspection] SSE connected:', data)
    setIsConnected(true)
    setIsReconnecting(false)
    setConnectionError(null)
  }, [])

  const handleError = useCallback((data) => {
    console.error('[LiveInspection] SSE error:', data)
    setIsConnected(false)
    
    if (data.fatal) {
      setConnectionError(data.message)
    }
    
    onError?.(data)
  }, [onError])

  const handleReconnecting = useCallback((data) => {
    console.log('[LiveInspection] SSE reconnecting:', data)
    setIsReconnecting(true)
  }, [])

  const handleHardwareStatus = useCallback((data) => {
    console.log('[LiveInspection] Hardware status:', data)

    // SSE sends {cameras: [...], plcs: [...]} at root level (confirmed with backend)
    // Fallback to data.hardware?.cameras for future compatibility
    const rawCameras = data.cameras || data.hardware?.cameras || []
    const rawPlcs = data.plcs || data.hardware?.plcs || []

    // Backend sends status as boolean (true/false), UI expects 'ONLINE'/'OFFLINE'
    const normalizeStatus = (s) => (s === true || s === 'ONLINE') ? 'ONLINE' : 'OFFLINE'

    setHardwareStatus({
      cameras: rawCameras.map(c => ({ ...c, status: normalizeStatus(c.status) })),
      plcs: rawPlcs.map(p => ({ ...p, status: normalizeStatus(p.status) })),
      timestamp: data.timestamp || Date.now()
    })
  }, [])

  const handleRunningStatus = useCallback((data) => {
    console.log('[LiveInspection] Running status:', data)

    // Auto Inspect Edge sends: {stage_id, stage, side, position_index, position}
    // stage values: STARTING, MOVING, FLIPPING, DONE
    // Map to UI stage name that matches stageDefinitions
    const backendStage = data.stage || data.stage_name || 'idle'
    const side = data.side
    const posIndex = data.position_index

    let stageName = 'idle'
    let message = 'Processing...'
    let icon = 'cpu'

    if (backendStage === 'STARTING') {
      stageName = 'board_incoming'
      message = side === 'bottom' ? 'Starting bottom side...' : 'Board incoming...'
      icon = 'box'
    } else if (backendStage === 'MOVING') {
      stageName = `position_${posIndex + 1}`
      message = `Position ${data.position || posIndex + 1} (${(side || '').toUpperCase()})...`
      icon = 'camera'
    } else if (backendStage === 'FLIPPING') {
      stageName = 'pcb_flipping'
      message = 'Flipping PCB...'
      icon = 'rotate-ccw'
    } else if (backendStage === 'DONE') {
      stageName = 'done'
      message = 'Motion complete'
      icon = 'check'
    } else {
      // Fallback for legacy format (stage_name field)
      stageName = backendStage.toLowerCase()
      message = STAGE_MESSAGES[stageName] || 'Processing...'
    }

    const stages = stageDefinitionsRef.current
    const currentTotalStages = stages.length

    let status = 'processing'
    if (stageName === 'done') status = 'ready'
    else if (stageName === 'idle') status = 'idle'

    // Use backend stage_id for progress (1-based sequential)
    const motionIdx = data.stage_id || 0

    setInspectionStage(prev => {
      if (stageName === 'done' && prev.status === 'ready' && prev.stageName === 'done') {
        return prev
      }

      const newMotionIdx = Math.min(motionIdx, currentTotalStages)
      return {
        ...prev,
        status,
        stageName,
        message,
        motionStageIndex: newMotionIdx,
        stageIndex: Math.max(newMotionIdx, prev.visionStageIndex),
        totalStages: currentTotalStages,
        icon
      }
    })
  }, []) // No dependencies - uses ref

  const handleVisionStatus = useCallback((data) => {
    console.log('[LiveInspection] Vision status:', data)

    // Auto Inspect Edge vision_stages: {stage_id, stage, side, position_index}
    // stage values: CAPTURING, PROCESSING, DONE
    const backendStage = data.stage || 'idle'
    const side = data.side
    const posIndex = data.position_index

    let stageName = 'processing'
    let message = 'Processing...'
    let icon = 'cpu'
    let status = 'processing'

    if (backendStage === 'CAPTURING') {
      stageName = `position_${posIndex + 1}`
      message = `Capturing ${(side || '').toUpperCase()} pos ${posIndex + 1}...`
      icon = 'camera'
      status = 'capturing'
    } else if (backendStage === 'PROCESSING') {
      stageName = `position_${posIndex + 1}`
      message = `AI processing ${(side || '').toUpperCase()} pos ${posIndex + 1}...`
      icon = 'cpu'
      status = 'processing'
    } else if (backendStage === 'DONE') {
      // Vision done - inspection result will arrive via inspection stream
      return
    }

    const stages = stageDefinitionsRef.current
    const currentTotalStages = stages.length
    const visionIdx = data.stage_id || 0

    setInspectionStage(prev => {
      const newVisionIdx = Math.min(visionIdx, currentTotalStages)
      return {
        ...prev,
        status,
        stageName,
        message,
        visionStageIndex: newVisionIdx,
        stageIndex: Math.max(prev.motionStageIndex, newVisionIdx),
        totalStages: currentTotalStages,
        icon
      }
    })
  }, []) // No dependencies - uses ref

  const handleInspection = useCallback((data) => {
    console.log('[LiveInspection] 🎯 ========================================')
    console.log('[LiveInspection] 🎯 INSPECTION EVENT RECEIVED!')
    console.log('[LiveInspection] 🎯 inspection_id:', data.inspection_id)
    console.log('[LiveInspection] 🎯 decision:', data.decision)
    console.log('[LiveInspection] 🎯 ========================================')

    // Auto Inspect Edge sends results as a flat list with `side` field per item.
    // Transform each frame to UI format.
    const transformFrame = (frame) => ({
      image_url: frame.url || frame.image_url,
      image_raw_url: frame.raw_url || frame.image_raw_url,
      side: (frame.side || 'top').toUpperCase(),
      position: frame.position,
      position_id: frame.position_id,
      frame_id: frame.frame_id,
      serial_number: frame.serial_number || null,
      user_confirmation: null,  // Set by HMI on operator decision (no longer from SSE)
      label: frame.label,  // board-level: true=NG, false=GOOD
      times: frame.times || null,  // { capture: number, inference: number }
      objects: (frame.objects || []).map(obj => ({
        name: obj.name,
        box: obj.box,
        score: obj.score,
        label: obj.label,
        crop_url: obj.crop_url,
        attrs: obj.attrs || null,
        side: (frame.side || 'top').toUpperCase()
      }))
    })

    // Handle both flat list (Auto Inspect Edge) and nested {top, bottom} (mock server)
    const rawResults = data.results?.results || data.results
    let topFrames = []
    let bottomFrames = []

    if (Array.isArray(rawResults)) {
      // Flat list from Auto Inspect Edge - split by side
      const frames = rawResults.map(transformFrame)
      topFrames = frames.filter(f => f.side === 'TOP')
      bottomFrames = frames.filter(f => f.side === 'BOTTOM')
    } else if (rawResults && typeof rawResults === 'object') {
      // Nested {top, bottom} from mock server
      topFrames = (rawResults.top || []).map(transformFrame)
      bottomFrames = (rawResults.bottom || []).map(transformFrame)
    }

    console.log('[LiveInspection] 🎯 Frames received: TOP=%d, BOTTOM=%d (raw: %d items)',
      topFrames.length, bottomFrames.length, Array.isArray(rawResults) ? rawResults.length : 'nested')

    // Extract serial number (same for all results in 1 inspection = 1 physical PCB)
    const allFrames = [...topFrames, ...bottomFrames]
    const serialNumber = allFrames.find(f => f.serial_number)?.serial_number || null

    // Keep frames that have ANY image (url or raw_url).
    // url = AI Engine visualization (with bbox), raw_url = original capture.
    // Display components prefer image_url but fall back to image_raw_url.
    const hasImage = (f) => f.image_url || f.image_raw_url

    const inspection = {
      inspectionId: data.inspection_id,
      modelId: data.model_id,
      modelName: data.model_name,
      serialNumber,
      results: {
        top: topFrames.filter(hasImage),
        bottom: bottomFrames.filter(hasImage)
      },
      decision: data.decision ? String(data.decision).toUpperCase() : data.decision,
      timestamp: data.timestamp
    }
    
    // Push to queue for multi-cavity support
    inspectionQueueRef.current.push(inspection)
    setQueueLength(inspectionQueueRef.current.length)

    // Update panel progress total
    setPanelProgress(prev => ({ ...prev, total: prev.total + 1 }))

    // If no active inspection, dequeue immediately.
    // Uses ref (not state) to avoid stale closure — SSE listener is registered
    // once during connect() and never re-registered, so the closure always sees
    // the initial currentInspection=null. The ref gives us the live value.
    if (!currentInspectionRef.current) {
      const next = inspectionQueueRef.current.shift()
      setQueueLength(inspectionQueueRef.current.length)
      setCurrentInspection(next)
      currentInspectionRef.current = next // Update ref immediately (don't wait for re-render)
    }

    setInspectionStage(prev => ({
      ...prev,
      status: 'ready',
      stageName: 'done',
      message: 'Ready for review',
      stageIndex: prev.totalStages,
      motionStageIndex: prev.totalStages,
      visionStageIndex: prev.totalStages,
      totalStages: prev.totalStages,
      icon: 'check'
    }))

    onInspectionComplete?.(inspection)
  }, [onInspectionComplete]) // Removed currentInspection — uses ref now

  const handleConfirmed = useCallback((data) => {
    console.log('[LiveInspection] Confirmed:', data)
    setLastConfirmation(data)

    // Reset for next inspection
    setCurrentInspection(null)
    currentInspectionRef.current = null
    setInspectionStage(prev => ({
      status: 'idle',
      stageName: 'idle',
      message: 'Waiting for board...',
      stageIndex: 0,
      motionStageIndex: 0,
      visionStageIndex: 0,
      totalStages: prev.totalStages,
      icon: 'hourglass'
    }))
  }, [])

  const handleSessionUpdate = useCallback((data) => {
    console.log('[LiveInspection] Session update:', data)
    const session = data.session || data
    setSessionStatus(session)
    
    // Update process status based on session status
    // Hardware status is NOT set here — device_status SSE stream is the source of truth
    if (session?.status) {
      setProcessStatus(session.status)
    }
  }, [])

  // ============================================
  // Connect to SSE
  // ============================================

  const connect = useCallback(async () => {
    if (!lineId) {
      console.warn('[LiveInspection] No lineId provided')
      return
    }

    // Check AI Backend health first
    const healthy = await checkAiBackend()
    if (!healthy) {
      return
    }

    // Fetch stage definitions
    await fetchStages()

    // Initialize session if WO available
    if (workOrder && !sessionStartedRef.current) {
      const sessionOk = await initSession()
      if (!sessionOk) {
        return
      }
    }

    // Disconnect old service to prevent duplicate listeners
    if (serviceRef.current) {
      serviceRef.current.disconnect()
    }

    // Create fresh service instance
    serviceRef.current = createAiBackendService(lineId)
    const service = serviceRef.current

    // Register event listeners (once per service instance)
    service.on('connected', handleConnected)
    service.on('error', handleError)
    service.on('reconnecting', handleReconnecting)
    service.on('device_status', handleHardwareStatus)
    service.on('motion_stages', handleRunningStatus)
    service.on('vision_stages', handleVisionStatus)
    service.on('inspection', handleInspection)
    service.on('confirmed', handleConfirmed)
    service.on('session_update', handleSessionUpdate)

    // Connect
    service.connect()
  }, [
    lineId, 
    workOrder, 
    checkAiBackend,
    fetchStages,
    initSession,
    handleConnected, 
    handleError, 
    handleReconnecting,
    handleHardwareStatus,
    handleRunningStatus,
    handleVisionStatus,
    handleInspection,
    handleConfirmed, 
    handleSessionUpdate
  ])

  // ============================================
  // Disconnect
  // ============================================

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect()
      serviceRef.current = null
    }
    setIsConnected(false)
    sessionStartedRef.current = false
  }, [])

  // ============================================
  // Reconnect
  // ============================================

  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(() => connect(), 500)
  }, [disconnect, connect])

  // ============================================
  // Process Control (RUN/PAUSE/STOP)
  // ============================================

  const runProcess = useCallback(async () => {
    // Use ref guard (synchronous) instead of state (batched by React).
    // Without this, two concurrent calls both see isControlling=false and proceed.
    if (isRunningProcessRef.current) return { success: false, error: 'Operation in progress' }
    isRunningProcessRef.current = true

    setIsControlling(true)
    try {
      // Reset simulation serial files to clear leftover PLC commands from previous sessions.
      // Without this, stale READY/POS_CONFIRM signals cause rapid-fire processing loops.
      await resetSimSerial()

      // Start inspection with model_id — backend handles selectModel() internally
      console.log('[LiveInspection] Calling POST /api/inspection/start with model_id:', modelName || '(none)')
      const result = await startInspection({ model_id: modelName || undefined })

      if (result.success) {
        setProcessStatus('RUNNING')
        setSessionStatus(result.data)

        // Only set initial optimistic status if no device_status SSE received yet
        // Once SSE device_status events arrive, they become the source of truth
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.length > 0
            ? prev.cameras  // Keep real SSE data
            : [{ id: 'cam-01', name: 'Inspection Camera', status: 'ONLINE' }],
          plcs: prev.plcs.length > 0
            ? prev.plcs     // Keep real SSE data
            : [{ id: 'plc-01', name: 'Conveyor PLC', status: 'ONLINE' }]
        }))
        console.log('[LiveInspection] Process started')

        // First board READY is handled by backend Patch 2 (auto-trigger _on_plc_ready).
        // Do NOT send triggerSimReady here — double READY causes two concurrent board
        // processings in DummySerial, leading to stuck at position movement.
        // Subsequent boards are triggered by triggerSimReady() in confirmInspection().
      } else {
        console.error('[LiveInspection] Failed to start process:', result.error)
      }
      return result
    } catch (error) {
      console.error('[LiveInspection] Run process error:', error)
      return { success: false, error: error.message }
    } finally {
      isRunningProcessRef.current = false
      setIsControlling(false)
    }
  }, [isControlling])

  const pauseProcess = useCallback(async () => {
    if (isControlling) return { success: false, error: 'Operation in progress' }

    setIsControlling(true)
    try {
      // Auto Inspect Edge: Pause inspection
      console.log('[LiveInspection] Calling POST /api/inspection/pause...')
      const result = await pauseInspection()

      if (result.success) {
        setProcessStatus('PAUSED')
        setSessionStatus(result.data)
        console.log('[LiveInspection] Process paused (SSE stays connected)')
      } else {
        console.error('[LiveInspection] Failed to pause process:', result.error)
      }
      return result
    } catch (error) {
      console.error('[LiveInspection] Pause process error:', error)
      return { success: false, error: error.message }
    } finally {
      setIsControlling(false)
    }
  }, [isControlling])

  const stopProcess = useCallback(async () => {
    if (isControlling) return { success: false, error: 'Operation in progress' }

    setIsControlling(true)
    try {
      // Auto Inspect Edge: Stop inspection
      console.log('[LiveInspection] Calling POST /api/inspection/stop...')
      const result = await stopInspection()
      
      if (result.success) {
        setProcessStatus('STOPPED')
        setSessionStatus(result.data)
        sessionStartedRef.current = false

        // Clear current inspection
        setCurrentInspection(null)
        currentInspectionRef.current = null

        // Reset stage to idle
        setInspectionStage({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
          motionStageIndex: 0,
          visionStageIndex: 0,
          totalStages: stageDefinitions.length,
          icon: 'hourglass'
        })

        // Hardware goes OFFLINE when process stops
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.map(c => ({ ...c, status: 'OFFLINE' })),
          plcs: prev.plcs.map(p => ({ ...p, status: 'OFFLINE' }))
        }))

        console.log('[LiveInspection] Process stopped, hardware OFFLINE (SSE stays connected)')
      } else {
        console.error('[LiveInspection] Failed to stop process:', result.error)
      }
      return result
    } catch (error) {
      console.error('[LiveInspection] Stop process error:', error)
      return { success: false, error: error.message }
    } finally {
      setIsControlling(false)
    }
  }, [isControlling, stageDefinitions.length])

  // ============================================
  // Switch Model (during STOPPED/PAUSED/IDLE)
  // ============================================

  const switchModel = useCallback(async (newModelName) => {
    if (isControlling) return { success: false, error: 'Operation in progress' }

    setIsControlling(true)
    try {
      console.log('[LiveInspection] Switching model to:', newModelName)
      const result = await selectModel(newModelName)

      if (result.success) {
        console.log('[LiveInspection] Model switched successfully to:', newModelName)
      } else {
        console.error('[LiveInspection] Failed to switch model:', result.error)
      }
      return result
    } catch (error) {
      console.error('[LiveInspection] Switch model error:', error)
      return { success: false, error: error.message }
    } finally {
      setIsControlling(false)
    }
  }, [isControlling])

  // ============================================
  // Confirm Inspection (Operator Decision)
  // ============================================

  const confirmInspection = useCallback(async (operatorDecision) => {
    if (!currentInspection) {
      console.warn('[LiveInspection] ⚠️ confirmInspection called but no currentInspection!')
      return { success: false, error: 'No active inspection' }
    }

    console.log('[LiveInspection] 🔄 Confirming inspection:', {
      inspectionId: currentInspection.inspectionId,
      operatorDecision,
      aiDecision: currentInspection.decision
    })

    setIsConfirming(true)

    try {
      const isFalseCall = calculateFalseCall(currentInspection.decision, operatorDecision)

      // Auto Inspect Edge does not have a /confirm endpoint.
      // Confirmation is handled locally and persisted to DB via Next.js API routes.
      console.log('[LiveInspection] ✅ Confirm - checking queue for next PCB')

      const isGood = operatorDecision === 'GOOD'

      setLastConfirmation({
        inspectionId: currentInspection.inspectionId,
        operatorDecision,
        aiDecision: currentInspection.decision,
        is_false_call: isFalseCall,
        timestamp: new Date().toISOString()
      })

      // Update panel progress
      setPanelProgress(prev => ({
        ...prev,
        confirmed: prev.confirmed + 1,
        good: prev.good + (isGood ? 1 : 0),
        ng: prev.ng + (isGood ? 0 : 1),
      }))

      // Dequeue next PCB from queue, or reset to idle
      const nextInspection = inspectionQueueRef.current.shift() || null
      setQueueLength(inspectionQueueRef.current.length)
      setCurrentInspection(nextInspection)
      currentInspectionRef.current = nextInspection // Keep ref in sync immediately

      if (!nextInspection) {
        // Queue empty — reset stage to idle and trigger next panel cycle
        setInspectionStage(prev => ({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
          motionStageIndex: 0,
          visionStageIndex: 0,
          totalStages: prev.totalStages,
          icon: 'hourglass'
        }))

        // Reset panel progress for next cycle
        setPanelProgress({ total: 0, confirmed: 0, good: 0, ng: 0 })

        // Trigger next inspection cycle (simulation mode: sends PLC READY signal)
        // In production, PLC sends READY automatically when a new board arrives.
        triggerSimReady()
      }

      return { success: true, data: { operatorDecision, isFalseCall } }
    } catch (error) {
      console.error('[LiveInspection] ❌ Confirm error:', error)
      return { success: false, error: error.message }
    } finally {
      setIsConfirming(false)
    }
  }, [currentInspection])

  // ============================================
  // Fetch stage definitions on mount (all roles)
  // ============================================

  useEffect(() => {
    if (lineId) {
      fetchStages()
    }
  }, [lineId, fetchStages])

  // ============================================
  // Auto-connect SSE on mount (operator only)
  // NOTE: Does NOT auto-run inspection. Operator must press RUN button.
  // This prevents stale counter increments from previous sessions.
  // ============================================

  // Guard: prevent double auto-connect when workOrder changes from mock to real
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (autoConnect && lineId && workOrder && !autoStartedRef.current) {
      autoStartedRef.current = true
      connect()
    }

    return () => {
      disconnect()
      autoStartedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, lineId]) // Stable deps - don't reconnect when WO changes

  // ============================================
  // Periodic Stream Health Check
  // ============================================

  useEffect(() => {
    if (!serviceRef.current) return

    const healthCheckInterval = setInterval(() => {
      if (serviceRef.current) {
        const status = serviceRef.current.getStreamStatus?.()
        if (status) {
          const inspectionOk = status.inspection?.isOpen
          const motionOk = status.motion_stages?.isOpen

          if (!inspectionOk) {
            console.warn('[LiveInspection] ⚠️ HEALTH CHECK: Inspection stream DOWN! Results will not arrive.')
          }
          if (!motionOk) {
            console.warn('[LiveInspection] ⚠️ HEALTH CHECK: Motion stages stream DOWN!')
          }

          // Log status every check
          console.log('[LiveInspection] 📊 Stream health:', {
            inspection: status.inspection?.status || 'MISSING',
            motion_stages: status.motion_stages?.status || 'MISSING',
            device_status: status.device_status?.status || 'MISSING'
          })
        }
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(healthCheckInterval)
  }, [isConnected])

  // ============================================
  // Clear Inspection (for VIEW ONLY mode sync)
  // ============================================

  const clearInspection = useCallback(() => {
    console.log('[LiveInspection] Clearing inspection (VIEW ONLY sync)')
    setCurrentInspection(null)
    currentInspectionRef.current = null
    setInspectionStage(prev => ({
      status: 'idle',
      stageName: 'idle',
      message: 'Waiting for board...',
      stageIndex: 0,
      motionStageIndex: 0,
      visionStageIndex: 0,
      totalStages: prev.totalStages,
      icon: 'hourglass'
    }))
  }, [])

  // ============================================
  // Return Hook Interface
  // ============================================

  return {
    // Connection state
    isConnected,
    isReconnecting,
    connectionError,
    aiBackendAvailable,

    // Hardware
    hardwareStatus,

    // Stage definitions (from /stages endpoint)
    stageDefinitions,

    // Inspection stage (for loading UI)
    inspectionStage,

    // Current inspection (for display)
    currentInspection,

    // Inspection queue (multi-cavity)
    queueLength,
    panelProgress,

    // Session & Process
    sessionStatus,
    processStatus,
    isControlling,

    // Confirmation
    isConfirming,
    lastConfirmation,
    confirmInspection,

    // Connection Methods
    connect,
    disconnect,
    reconnect,
    checkAiBackend,
    getStreamStatus: () => serviceRef.current?.getStreamStatus?.() || {},

    // Inspection control
    clearInspection,

    // Process Control Methods
    runProcess,
    pauseProcess,
    stopProcess,
    switchModel
  }
}

export default useLiveInspection

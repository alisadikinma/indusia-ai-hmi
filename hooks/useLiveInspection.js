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
  getCurrentModel,
  checkHealth,
  getStages,
  calculateFalseCall,
  triggerSimReady
} from '@/lib/services/aiBackendService'

// Default stage definitions (fallback if /stages fails)
// Must match AI Backend's 7-stage flow
const DEFAULT_STAGES = [
  { stage_id: 'stage-01', name: 'board_incoming', label: 'Board', icon: 'box' },
  { stage_id: 'stage-02', name: 'position_1', label: 'Pos 1', icon: 'camera' },
  { stage_id: 'stage-03', name: 'position_2', label: 'Pos 2', icon: 'camera' },
  { stage_id: 'stage-04', name: 'pcb_flipping', label: 'Flip', icon: 'rotate-ccw' },
  { stage_id: 'stage-05', name: 'position_3', label: 'Pos 3', icon: 'camera' },
  { stage_id: 'stage-06', name: 'position_4', label: 'Pos 4', icon: 'camera' },
  { stage_id: 'stage-07', name: 'done', label: 'Done', icon: 'check' }
]

// Stage message map
const STAGE_MESSAGES = {
  'idle': 'Waiting for board...',
  'start': 'Board incoming...',
  'board_incoming': 'Board incoming...',
  'position_1': 'Camera Position 1...',
  'position_2': 'Camera Position 2...',
  'flip': 'Flipping PCB...',
  'pcb_flipping': 'Flipping PCB...',
  'position_3': 'Camera Position 3...',
  'position_4': 'Camera Position 4...',
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
    totalStages: DEFAULT_STAGES.length,
    icon: 'hourglass'
  })

  // Current inspection data (from SSE inspection event)
  const [currentInspection, setCurrentInspection] = useState(null)

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

  // Keep ref in sync with state
  useEffect(() => {
    stageDefinitionsRef.current = stageDefinitions
  }, [stageDefinitions])

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

    try {
      // Auto Inspect Edge: Select model based on board
      // TEMP FIX: Skip model selection in simulation mode (model files not available)
      const modelName = 'pcb_1'

      console.log('[LiveInspection] Attempting to select model:', modelName)
      const result = await selectModel(modelName)

      if (result.success) {
        sessionStartedRef.current = true
        console.log('[LiveInspection] Model selected successfully')
        setProcessStatus('READY')
        return true
      } else {
        // Check if error is "model not found" (simulation mode - skip it)
        if (result.error?.toLowerCase().includes('not found')) {
          console.log('[LiveInspection] ⚠️ Model not found (simulation mode) - skipping model selection')
          sessionStartedRef.current = true
          setConnectionError(null)
          setProcessStatus('READY')
          return true
        }

        // Check if error is "session already active"
        if (result.error?.toLowerCase().includes('already active') ||
            result.error?.toLowerCase().includes('session active')) {
          console.log('[LiveInspection] Session already active, resuming...')
          sessionStartedRef.current = true
          setConnectionError(null) // Clear error - this is OK
          setProcessStatus('READY')
          return true
        }

        console.error('[LiveInspection] Failed to start session:', result.error)
        setConnectionError(result.error)
        return false
      }
    } catch (error) {
      console.error('[LiveInspection] Session init error:', error)
      setConnectionError(error.message)
      return false
    }
  }, [workOrder, lineId])

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
    setHardwareStatus({
      cameras: data.hardware?.cameras || [],
      plcs: data.hardware?.plcs || [],
      timestamp: data.timestamp
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
    const stageIndex = data.stage_id || 0

    setInspectionStage(prev => {
      if (stageName === 'done' && prev.status === 'ready' && prev.stageName === 'done') {
        return prev
      }

      return {
        status,
        stageName,
        message,
        stageIndex: Math.min(stageIndex, currentTotalStages),
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
    const stageIndex = data.stage_id || 0

    setInspectionStage({
      status,
      stageName,
      message,
      stageIndex: Math.min(stageIndex, currentTotalStages),
      totalStages: currentTotalStages,
      icon
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
      objects: (frame.objects || []).map(obj => ({
        name: obj.name,
        box: obj.box,
        score: obj.score,
        label: obj.label,
        crop_url: obj.crop_url,
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

    const inspection = {
      inspectionId: data.inspection_id,
      modelId: data.model_id,
      modelName: data.model_name,
      results: {
        top: topFrames.filter(f => f.image_url),
        bottom: bottomFrames.filter(f => f.image_url)
      },
      decision: data.decision,
      timestamp: data.timestamp
    }
    
    setCurrentInspection(inspection)
    setInspectionStage(prev => ({
      status: 'ready',
      stageName: 'done',
      message: 'Ready for review',
      stageIndex: prev.totalStages,
      totalStages: prev.totalStages,
      icon: 'check'
    }))
    
    onInspectionComplete?.(inspection)
  }, [onInspectionComplete])

  const handleConfirmed = useCallback((data) => {
    console.log('[LiveInspection] Confirmed:', data)
    setLastConfirmation(data)
    
    // Reset for next inspection
    setCurrentInspection(null)
    setInspectionStage(prev => ({
      status: 'idle',
      stageName: 'idle',
      message: 'Waiting for board...',
      stageIndex: 0,
      totalStages: prev.totalStages,
      icon: 'hourglass'
    }))
  }, [])

  const handleSessionUpdate = useCallback((data) => {
    console.log('[LiveInspection] Session update:', data)
    const session = data.session || data
    setSessionStatus(session)
    
    // Update process status based on session status
    if (session?.status) {
      setProcessStatus(session.status)
      
      // Sync hardware status with process status
      if (session.status === 'RUNNING' || session.status === 'PAUSED') {
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.length > 0 
            ? prev.cameras.map(c => ({ ...c, status: 'ONLINE' }))
            : [{ id: 'cam-01', name: 'Inspection Camera', status: 'ONLINE' }],
          plcs: prev.plcs.length > 0
            ? prev.plcs.map(p => ({ ...p, status: 'ONLINE' }))
            : [{ id: 'plc-01', name: 'Conveyor PLC', status: 'ONLINE' }]
        }))
      } else if (session.status === 'STOPPED') {
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.map(c => ({ ...c, status: 'OFFLINE' })),
          plcs: prev.plcs.map(p => ({ ...p, status: 'OFFLINE' }))
        }))
      }
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
    if (isControlling) return { success: false, error: 'Operation in progress' }

    setIsControlling(true)
    try {
      // Auto Inspect Edge: Start inspection
      console.log('[LiveInspection] Calling POST /api/inspection/start...')
      const result = await startInspection()

      if (result.success) {
        setProcessStatus('RUNNING')
        setSessionStatus(result.data)

        // Hardware goes ONLINE when process runs
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.length > 0
            ? prev.cameras.map(c => ({ ...c, status: 'ONLINE' }))
            : [{ id: 'cam-01', name: 'Inspection Camera', status: 'ONLINE' }],
          plcs: prev.plcs.length > 0
            ? prev.plcs.map(p => ({ ...p, status: 'ONLINE' }))
            : [{ id: 'plc-01', name: 'Conveyor PLC', status: 'ONLINE' }]
        }))
        console.log('[LiveInspection] Process started, hardware ONLINE')

        // In simulation mode, trigger first board arrival (PLC READY signal)
        // In production, PLC sends READY automatically when a board arrives
        setTimeout(() => {
          console.log('[LiveInspection] Triggering first board (sim READY)...')
          triggerSimReady()
        }, 1500)
      } else {
        console.error('[LiveInspection] Failed to start process:', result.error)
      }
      return result
    } catch (error) {
      console.error('[LiveInspection] Run process error:', error)
      return { success: false, error: error.message }
    } finally {
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

        // Reset stage to idle
        setInspectionStage({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
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
      console.log('[LiveInspection] ✅ Confirm - resetting for next inspection')

      setLastConfirmation({
        inspectionId: currentInspection.inspectionId,
        operatorDecision,
        aiDecision: currentInspection.decision,
        is_false_call: isFalseCall,
        timestamp: new Date().toISOString()
      })

      // Reset for next inspection
      setCurrentInspection(null)
      setInspectionStage(prev => ({
        status: 'idle',
        stageName: 'idle',
        message: 'Waiting for board...',
        stageIndex: 0,
        totalStages: prev.totalStages,
        icon: 'hourglass'
      }))

      // Trigger next inspection cycle (simulation mode: sends PLC READY signal)
      // In production, PLC sends READY automatically when a new board arrives.
      triggerSimReady()

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
  // Auto-connect and Auto-run on mount (operator only)
  // ============================================

  useEffect(() => {
    if (autoConnect && lineId && workOrder) {
      // Auto connect and auto run
      const autoStartSequence = async () => {
        await connect()
        
        // Wait a bit for connection to establish, then auto-run
        setTimeout(async () => {
          if (serviceRef.current?.isConnected()) {
            console.log('[LiveInspection] Auto-starting process...')
            await runProcess()
          }
        }, 1000)
      }
      
      autoStartSequence()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, lineId, workOrder?.id]) // Only reconnect if WO changes

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
    setInspectionStage(prev => ({
      status: 'idle',
      stageName: 'idle',
      message: 'Waiting for board...',
      stageIndex: 0,
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
    stopProcess
  }
}

export default useLiveInspection

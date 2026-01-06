/**
 * useLiveInspection Hook
 * Manages SSE connection to AI Backend and inspection state
 * 
 * Flow:
 * 1. Connect SSE when WO is ready
 * 2. Listen for hardware_status, running_status, inspection events
 * 3. Display loading during capture/processing stages
 * 4. Display dual-side images when inspection event arrives
 * 5. POST /confirm after operator decision
 * 6. Reset and wait for next inspection
 * 
 * @module hooks/useLiveInspection
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  createAiBackendService, 
  startSession, 
  // TODO: Uncomment when AI Backend endpoints ready
  // runSession,
  // pauseSession,
  // stopSession,
  getSessionStatus,
  postConfirm,
  checkHealth,
  getStages
} from '@/lib/services/aiBackendService'

// Default stage definitions (fallback if /stages fails)
const DEFAULT_STAGES = [
  { stage_id: 'stage-01', name: 'start', label: 'Board', icon: 'box' },
  { stage_id: 'stage-02', name: 'running', label: 'Process', icon: 'cpu' },
  { stage_id: 'stage-03', name: 'done', label: 'Done', icon: 'check' }
]

// Stage message map
const STAGE_MESSAGES = {
  'idle': 'Waiting for board...',
  'start': 'Board incoming...',
  'position_1': 'Camera Position 1...',
  'position_2': 'Camera Position 2...',
  'flip': 'Flipping PCB...',
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
      setConnectionError('AI Backend tidak tersedia. Pastikan server berjalan di port 8001')
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
      const sessionData = {
        work_order_id: workOrder.id,
        work_order_number: workOrder.woNumber,
        line_id: lineId,
        line_name: workOrder.line?.name || null,
        board_id: workOrder.boardId,
        board_name: workOrder.board?.name || 'PCB',
        lot_size: workOrder.lotSize,
        side_count: workOrder.sideCount || 1
      }

      console.log('[LiveInspection] Starting session:', sessionData)
      const result = await startSession(sessionData)

      if (result.success) {
        sessionStartedRef.current = true
        setSessionStatus(result.data)
        if (result.data?.status) {
          setProcessStatus(result.data.status)
        }
        return true
      } else {
        // Check if error is "session already active"
        if (result.error?.toLowerCase().includes('already active') || 
            result.error?.toLowerCase().includes('session active')) {
          console.log('[LiveInspection] Session already active, resuming...')
          sessionStartedRef.current = true
          setConnectionError(null) // Clear error - this is OK
          
          // Try to get current session status
          const statusResult = await getSessionStatus()
          if (statusResult.success) {
            setSessionStatus(statusResult.data)
            if (statusResult.data?.status) {
              setProcessStatus(statusResult.data.status)
            }
          }
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
    
    const stageName = data.stage_name || 'idle'
    const message = STAGE_MESSAGES[stageName] || 'Processing...'
    
    // Use ref to get latest stageDefinitions (avoid closure issue)
    const stages = stageDefinitionsRef.current
    
    // Find stage index from stageDefinitions
    const stageIndex = stages.findIndex(s => s.name === stageName) + 1
    const currentTotalStages = stages.length
    
    // Find stage icon from definitions
    const stageDef = stages.find(s => s.name === stageName)
    const icon = stageDef?.icon || 'cpu'
    
    // Determine status based on stage name
    let status = 'idle'
    if (stageName === 'done') {
      status = 'ready'
    } else if (stageName === 'idle') {
      status = 'idle'
    } else {
      // All other stages (start, position_1, position_2, flip, etc) are processing
      status = 'processing'
    }
    
    // Guard: Ignore duplicate done events to prevent stuck animation
    setInspectionStage(prev => {
      if (stageName === 'done' && prev.status === 'ready' && prev.stageName === 'done') {
        // Already in ready/done state, skip update to prevent re-render loop
        return prev
      }
      
      return {
        status,
        stageName,
        message,
        stageIndex: stageIndex > 0 ? stageIndex : 0,
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
    
    // Get results - handle nested structure from dev.py
    const resultsData = data.results?.results || data.results
    
    // Transform to UI format - top/bottom are arrays of frames
    const transformFrames = (frames, side) => {
      if (!frames) return []
      // Ensure it's an array
      const frameArray = Array.isArray(frames) ? frames : [frames]
      return frameArray.map(frame => ({
        image_url: frame.image_url,
        objects: (frame.objects || []).map(obj => ({
          name: obj.name,
          box: obj.box,
          score: obj.score,
          label: obj.label,
          crop_url: obj.crop_url,
          side
        }))
      })).filter(f => f.image_url) // Only include frames with images
    }
    
    const inspection = {
      inspectionId: data.inspection_id,
      modelId: data.model_id,
      modelName: data.model_name,
      results: {
        top: transformFrames(resultsData?.top, 'TOP'),
        bottom: transformFrames(resultsData?.bottom, 'BOTTOM')
      },
      decision: data.decision, // 'PASS' or 'FAIL'
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

    // Create service if not exists
    if (!serviceRef.current) {
      serviceRef.current = createAiBackendService(lineId)
    }

    const service = serviceRef.current

    // Register event listeners
    service.on('connected', handleConnected)
    service.on('error', handleError)
    service.on('reconnecting', handleReconnecting)
    service.on('hardware_status', handleHardwareStatus)
    service.on('running_status', handleRunningStatus)
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
      // TODO: Uncomment when AI Backend endpoint ready
      // const result = await runSession()
      
      // Stub response for now
      const result = { success: true, data: { status: 'RUNNING' } }
      console.log('[LiveInspection] runSession (stub) - endpoint not ready')
      
      if (result.success) {
        setProcessStatus('RUNNING')
        setSessionStatus(result.data)
        
        // Reconnect SSE if disconnected
        if (serviceRef.current && !serviceRef.current.isConnected()) {
          console.log('[LiveInspection] 🔌 Reconnecting SSE (RUN)')
          await serviceRef.current.connect()
          setIsConnected(true)
        }
        
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
        console.log('[LiveInspection] Process started, SSE connected, hardware ONLINE')
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
      // TODO: Uncomment when AI Backend endpoint ready
      // const result = await pauseSession()
      
      // Stub response for now
      const result = { success: true, data: { status: 'PAUSED' } }
      console.log('[LiveInspection] pauseSession (stub) - endpoint not ready')
      
      if (result.success) {
        setProcessStatus('PAUSED')
        setSessionStatus(result.data)
        
        // Disconnect SSE when paused
        if (serviceRef.current) {
          console.log('[LiveInspection] 🔌 Disconnecting SSE (PAUSED)')
          serviceRef.current.disconnect()
          setIsConnected(false)
        }
        
        console.log('[LiveInspection] Process paused, SSE disconnected')
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
      // TODO: Uncomment when AI Backend endpoint ready
      // const result = await stopSession()
      
      // Stub response for now
      const result = { success: true, data: { status: 'STOPPED' } }
      console.log('[LiveInspection] stopSession (stub) - endpoint not ready')
      
      if (result.success) {
        setProcessStatus('STOPPED')
        setSessionStatus(result.data)
        sessionStartedRef.current = false
        
        // Disconnect SSE when stopped
        if (serviceRef.current) {
          console.log('[LiveInspection] 🔌 Disconnecting SSE (STOPPED)')
          serviceRef.current.disconnect()
          setIsConnected(false)
        }
        
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
        
        console.log('[LiveInspection] Process stopped, SSE disconnected, hardware OFFLINE')
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

  const confirmInspection = useCallback(async (operatorDecision, options = {}) => {
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
      const result = await postConfirm(
        currentInspection.inspectionId,
        operatorDecision,
        currentInspection.decision,
        {
          falseCallReason: options.falseCallReason,
          comment: options.comment
        }
      )

      console.log('[LiveInspection] 📬 Confirm result:', result)

      if (result.success) {
        console.log('[LiveInspection] ✅ Confirm SUCCESS - resetting for next inspection')
        
        setLastConfirmation({
          ...result.data,
          operatorDecision,
          aiDecision: currentInspection.decision,
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
      } else {
        console.error('[LiveInspection] ❌ Confirm FAILED:', result.error)
      }

      return result
    } catch (error) {
      console.error('[LiveInspection] ❌ Confirm error:', error)
      return { success: false, error: error.message }
    } finally {
      setIsConfirming(false)
    }
  }, [currentInspection])

  // ============================================
  // Auto-connect and Auto-run on mount
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
          const runningOk = status.running_status?.isOpen
          
          if (!inspectionOk) {
            console.warn('[LiveInspection] ⚠️ HEALTH CHECK: Inspection stream DOWN! Results will not arrive.')
          }
          if (!runningOk) {
            console.warn('[LiveInspection] ⚠️ HEALTH CHECK: Running status stream DOWN!')
          }
          
          // Log status every check
          console.log('[LiveInspection] 📊 Stream health:', {
            inspection: status.inspection?.status || 'MISSING',
            running_status: status.running_status?.status || 'MISSING',
            hardware_status: status.hardware_status?.status || 'MISSING'
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

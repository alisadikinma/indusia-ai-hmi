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
  runSession,
  pauseSession,
  stopSession,
  getSessionStatus,
  postConfirm,
  checkHealth 
} from '@/lib/services/aiBackendService'

// Stage definitions for progress tracking (matches dev.py)
const STAGE_MAP = {
  'idle': { index: 0, message: 'Waiting for board...', icon: 'hourglass' },
  'start': { index: 1, message: 'Board incoming...', icon: 'loader' },
  'running': { index: 2, message: 'Processing...', icon: 'cpu' },
  'done': { index: 3, message: 'Ready for review', icon: 'check' }
}

const TOTAL_STAGES = 3

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

  // Inspection stage (for loading UI)
  const [inspectionStage, setInspectionStage] = useState({
    status: 'idle',  // 'idle' | 'capturing' | 'processing' | 'ready'
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: TOTAL_STAGES,
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
    const stageInfo = STAGE_MAP[stageName] || STAGE_MAP['idle']
    
    // Determine status based on stage (dev.py: start, running, done)
    let status = 'idle'
    if (stageName === 'done') {
      status = 'ready'
    } else if (stageName === 'running') {
      status = 'processing'
    } else if (stageName === 'start') {
      status = 'capturing'
    }
    
    setInspectionStage({
      status,
      stageName,
      message: stageInfo.message,
      stageIndex: stageInfo.index,
      totalStages: TOTAL_STAGES,
      icon: stageInfo.icon
    })
  }, [])

  const handleInspection = useCallback((data) => {
    console.log('[LiveInspection] Inspection result:', data)
    
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
    setInspectionStage({
      status: 'ready',
      stageName: 'done',
      message: 'Ready for review',
      stageIndex: TOTAL_STAGES,
      totalStages: TOTAL_STAGES,
      icon: 'check'
    })
    
    onInspectionComplete?.(inspection)
  }, [onInspectionComplete])

  const handleConfirmed = useCallback((data) => {
    console.log('[LiveInspection] Confirmed:', data)
    setLastConfirmation(data)
    
    // Reset for next inspection
    setCurrentInspection(null)
    setInspectionStage({
      status: 'idle',
      stageName: 'idle',
      message: 'Waiting for board...',
      stageIndex: 0,
      totalStages: TOTAL_STAGES,
      icon: 'hourglass'
    })
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
      const result = await runSession()
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
      const result = await pauseSession()
      if (result.success) {
        setProcessStatus('PAUSED')
        setSessionStatus(result.data)
        // Hardware stays ONLINE when paused
        console.log('[LiveInspection] Process paused')
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
      const result = await stopSession()
      if (result.success) {
        setProcessStatus('STOPPED')
        setSessionStatus(result.data)
        sessionStartedRef.current = false
        // Hardware goes OFFLINE when process stops
        setHardwareStatus(prev => ({
          ...prev,
          cameras: prev.cameras.map(c => ({ ...c, status: 'OFFLINE' })),
          plcs: prev.plcs.map(p => ({ ...p, status: 'OFFLINE' }))
        }))
        console.log('[LiveInspection] Process stopped, hardware OFFLINE')
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
  }, [isControlling])

  // ============================================
  // Confirm Inspection (Operator Decision)
  // ============================================

  const confirmInspection = useCallback(async (operatorDecision, options = {}) => {
    if (!currentInspection) {
      return { success: false, error: 'No active inspection' }
    }

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

      if (result.success) {
        setLastConfirmation({
          ...result.data,
          operatorDecision,
          aiDecision: currentInspection.decision,
          timestamp: new Date().toISOString()
        })

        // Reset for next inspection
        setCurrentInspection(null)
        setInspectionStage({
          status: 'idle',
          stageName: 'idle',
          message: 'Waiting for board...',
          stageIndex: 0,
          totalStages: TOTAL_STAGES,
          icon: 'hourglass'
        })
      }

      return result
    } catch (error) {
      console.error('[LiveInspection] Confirm error:', error)
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

    // Process Control Methods
    runProcess,
    pauseProcess,
    stopProcess
  }
}

export default useLiveInspection

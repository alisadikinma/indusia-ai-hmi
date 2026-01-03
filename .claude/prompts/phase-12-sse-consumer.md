# Phase 12: SSE Consumer & AI Backend Client

## Objective
1. Create AI Backend client service for SSE connection and REST calls
2. Update Next.js UI to consume all SSE event types
3. Implement POST /confirm to AI Backend
4. Handle reconnection and fallback to dev simulation

---

## Context

AI Backend (separate Python/FastAPI project) streams SSE events and handles PLC control. This Next.js UI needs to:
1. Connect to AI Backend SSE endpoint (external server)
2. Handle all event types: `inspection`, `hardware_status`, `running_status`
3. Send operator confirmation via POST /confirm
4. Auto-reconnect on connection loss
5. Fallback to dev simulation when AI Backend unavailable

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SSE & REST Communication                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                           ┌─────────────────┐          │
│  │   AI Backend    │       SSE Events          │   Next.js UI    │          │
│  │  (Python/Fast)  │ ─────────────────────────▶│                 │          │
│  │                 │   • inspection            │  useLiveInsp()  │          │
│  │  localhost:8001 │   • hardware_status       │                 │          │
│  │                 │   • running_status        │                 │          │
│  │                 │                           │                 │          │
│  │                 │◀───────────────────────── │                 │          │
│  │                 │   POST /confirm           │  aiBackendSvc   │          │
│  │                 │   GET /stages             │                 │          │
│  └─────────────────┘                           └─────────────────┘          │
│                                                        │                    │
│                                                        │ fallback           │
│                                                        ▼                    │
│                                                ┌─────────────────┐          │
│                                                │  Dev Simulation │          │
│                                                │  /api/dev/sse   │          │
│                                                └─────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Contract Reference (from PDF)

### SSE Events

```javascript
// 1. inspection
{
  "inspection_id": "insp-8e1c4c6b",
  "model_id": "uuid",
  "model_name": "pcb_1",
  "results": {
    "top": { "image_url": "...", "objects": [...] },
    "bottom": { "image_url": "", "objects": [] }
  },
  "decision": "PASS",  // PASS or FAIL
  "timestamp": "2026-01-03T13:41:31Z"
}

// 2. hardware_status
{
  "status_id": "status-20260103-001",
  "timestamp": "...",
  "hardware": {
    "cameras": [{ "id": "cam-01", "name": "Top Camera", "status": "ONLINE", "message": null }],
    "plcs": [{ "id": "plc-01", "name": "Conveyor PLC", "status": "ONLINE", "message": null }]
  }
}

// 3. running_status
{
  "status_id": "run-20260103-003",
  "stage_id": "stage-03",
  "stage_name": "camera_position_2",
  "completed": false,
  "stage_timestamp": null
}
```

### REST Endpoints

```javascript
// GET /stages
{
  "status_id": "stages-20260103-001",
  "timestamp": "...",
  "stages": [
    { "stage_id": "stage-01", "name": "unit_comming", "completed": true, "timestamp": "..." },
    { "stage_id": "stage-02", "name": "camera_position_1", "completed": true, "timestamp": "..." },
    // ...
  ]
}

// POST /confirm
// Request:
{
  "inspection_id": "insp-8e1c4c6b",
  "unit_id": "PCB-20260103-00021",  // Optional
  "is_actual_ng": true,              // true = NG, false = GOOD
  "comment": "..."                   // Optional
}
// Response:
{
  "status": "OK",
  "inspection_id": "insp-8e1c4c6b",
  "confirmed_at": "2026-01-03T16:30:00Z",
  "is_actual_ng": true
}
```

---

## Task 1: Create AI Backend Client Service

### 1.1 `lib/services/aiBackendService.js`

```javascript
/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to AI Backend
 */

const AI_BACKEND_URL = process.env.NEXT_PUBLIC_AI_BACKEND_URL || 'http://localhost:8001'
const AI_BACKEND_SSE_URL = process.env.NEXT_PUBLIC_AI_BACKEND_SSE_URL || `${AI_BACKEND_URL}/sse`
const DEV_SSE_URL = '/api/dev/sse'

// ============================================
// Transform Layer
// ============================================

/**
 * Convert operator decision to AI Backend format
 * UI uses: 'GOOD' / 'NG'
 * AI Backend expects: is_actual_ng (boolean)
 */
export function toAiBackendFormat(operatorDecision) {
  return {
    is_actual_ng: operatorDecision === 'NG'
  }
}

/**
 * Convert AI Backend response to UI format
 */
export function fromAiBackendFormat(response) {
  return {
    ...response,
    operator_decision: response.is_actual_ng ? 'NG' : 'GOOD'
  }
}

/**
 * Calculate false call based on AI decision vs Operator decision
 */
export function calculateFalseCall(aiDecision, operatorDecision) {
  return (
    (aiDecision === 'PASS' && operatorDecision === 'NG') ||
    (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
  )
}

// ============================================
// SSE Connection
// ============================================

/**
 * SSE Connection Manager with auto-reconnect
 */
export class SSEConnection {
  constructor(lineId, options = {}) {
    this.lineId = lineId
    this.eventSource = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10
    this.baseDelay = options.baseDelay || 1000
    this.maxDelay = options.maxDelay || 30000
    this.useDevSimulation = options.useDevSimulation || false
    
    this.listeners = {
      inspection: [],
      hardware_status: [],
      running_status: [],
      connected: [],
      error: [],
      reconnecting: []
    }
  }

  /**
   * Get SSE URL based on environment
   */
  getSSEUrl() {
    if (this.useDevSimulation) {
      return `${DEV_SSE_URL}/${this.lineId}`
    }
    return `${AI_BACKEND_SSE_URL}/${this.lineId}`
  }

  /**
   * Connect to SSE stream
   */
  connect() {
    if (this.eventSource) {
      this.disconnect()
    }

    const url = this.getSSEUrl()
    console.log(`[SSE] Connecting to ${url}`)

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        console.log('[SSE] Connected')
        this.reconnectAttempts = 0
        this._emit('connected', { url, timestamp: new Date().toISOString() })
      }

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        this._emit('error', { error, timestamp: new Date().toISOString() })
        this._handleReconnect()
      }

      // Register event listeners
      this._registerEventListener('inspection')
      this._registerEventListener('hardware_status')
      this._registerEventListener('running_status')
      this._registerEventListener('heartbeat')

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      this._handleReconnect()
    }
  }

  /**
   * Register SSE event listener
   */
  _registerEventListener(eventType) {
    this.eventSource.addEventListener(eventType, (e) => {
      try {
        const data = JSON.parse(e.data)
        this._emit(eventType, data)
      } catch (err) {
        console.error(`[SSE] Failed to parse ${eventType} event:`, err)
      }
    })
  }

  /**
   * Handle reconnection with exponential backoff
   */
  _handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      
      // Fallback to dev simulation if AI Backend unavailable
      if (!this.useDevSimulation) {
        console.log('[SSE] Falling back to dev simulation')
        this.useDevSimulation = true
        this.reconnectAttempts = 0
        this.connect()
        return
      }
      
      this._emit('error', { 
        message: 'Max reconnect attempts reached',
        fatal: true 
      })
      return
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxDelay
    )
    
    this.reconnectAttempts++
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this._emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      delay,
      useDevSimulation: this.useDevSimulation
    })

    setTimeout(() => this.connect(), delay)
  }

  /**
   * Disconnect SSE
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      console.log('[SSE] Disconnected')
    }
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback)
    }
    return () => this.off(eventType, callback)
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback)
    }
  }

  /**
   * Emit event to listeners
   */
  _emit(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(cb => cb(data))
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// ============================================
// REST API Calls
// ============================================

/**
 * POST /confirm - Send operator confirmation to AI Backend
 * This triggers PLC action
 * 
 * @param {string} inspectionId - Inspection ID from SSE event
 * @param {string} operatorDecision - 'GOOD' or 'NG'
 * @param {string} aiDecision - 'PASS' or 'FAIL' (for false call calculation)
 * @param {object} options - Additional options
 */
export async function postConfirm(inspectionId, operatorDecision, aiDecision, options = {}) {
  const { unitId, comment, useDev = false } = options
  
  // Calculate false call
  const isFalseCall = calculateFalseCall(aiDecision, operatorDecision)
  
  // Transform to AI Backend format
  const payload = {
    inspection_id: inspectionId,
    ...toAiBackendFormat(operatorDecision),
    ...(unitId && { unit_id: unitId }),
    ...(comment && { comment })
  }

  // Choose endpoint based on environment
  const endpoint = useDev 
    ? '/api/dev/confirm' 
    : `${AI_BACKEND_URL}/confirm`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
    // Transform response and add calculated fields
    return {
      success: true,
      data: {
        ...fromAiBackendFormat(data),
        is_false_call: isFalseCall,
        ai_decision: aiDecision
      }
    }
  } catch (error) {
    console.error('[AI Backend] POST /confirm error:', error)
    
    // Fallback to dev endpoint if AI Backend fails
    if (!useDev) {
      console.log('[AI Backend] Falling back to dev endpoint')
      return postConfirm(inspectionId, operatorDecision, aiDecision, { ...options, useDev: true })
    }
    
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * GET /stages - Get conveyor stage definitions
 */
export async function getStages(options = {}) {
  const { useDev = false, withProgress = false } = options
  
  const endpoint = useDev 
    ? `/api/dev/stages${withProgress ? '?progress=true' : ''}`
    : `${AI_BACKEND_URL}/stages${withProgress ? '?progress=true' : ''}`

  try {
    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('[AI Backend] GET /stages error:', error)
    
    // Fallback to dev endpoint
    if (!useDev) {
      return getStages({ ...options, useDev: true })
    }
    
    return { success: false, error: error.message }
  }
}

/**
 * Check AI Backend health
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    return response.ok
  } catch {
    return false
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create AI Backend service instance
 */
export function createAiBackendService(lineId, options = {}) {
  const connection = new SSEConnection(lineId, options)
  
  return {
    // SSE
    connect: () => connection.connect(),
    disconnect: () => connection.disconnect(),
    on: (event, cb) => connection.on(event, cb),
    off: (event, cb) => connection.off(event, cb),
    isConnected: () => connection.isConnected(),
    
    // REST
    postConfirm: (inspectionId, operatorDecision, aiDecision, opts) => 
      postConfirm(inspectionId, operatorDecision, aiDecision, { 
        ...opts, 
        useDev: connection.useDevSimulation 
      }),
    getStages: (opts) => getStages({ ...opts, useDev: connection.useDevSimulation }),
    
    // Utils
    calculateFalseCall,
    checkHealth
  }
}

export default {
  SSEConnection,
  postConfirm,
  getStages,
  checkHealth,
  createAiBackendService,
  toAiBackendFormat,
  fromAiBackendFormat,
  calculateFalseCall
}
```

---

## Task 2: Update useLiveInspection Hook

### 2.1 `hooks/useLiveInspection.js`

```javascript
/**
 * Live Inspection Hook
 * Connects to AI Backend SSE and manages inspection state
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createAiBackendService } from '@/lib/services/aiBackendService'

const MAX_HISTORY = 50

export function useLiveInspection(lineId, options = {}) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [useDevSimulation, setUseDevSimulation] = useState(false)
  
  // Inspection state
  const [currentInspection, setCurrentInspection] = useState(null)
  const [history, setHistory] = useState([])
  
  // Hardware state
  const [hardwareStatus, setHardwareStatus] = useState(null)
  const [runningStatus, setRunningStatus] = useState(null)
  
  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false)
  const [lastConfirmation, setLastConfirmation] = useState(null)
  
  // Service ref
  const serviceRef = useRef(null)

  // Initialize service
  useEffect(() => {
    if (!lineId) return

    const service = createAiBackendService(lineId, {
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      useDevSimulation: options.useDevSimulation || false
    })
    
    serviceRef.current = service

    // Event listeners
    service.on('connected', (data) => {
      setIsConnected(true)
      setIsReconnecting(false)
      setConnectionError(null)
      console.log('[useLiveInspection] Connected:', data)
    })

    service.on('error', (data) => {
      setConnectionError(data.message || 'Connection error')
      if (data.fatal) {
        setIsConnected(false)
        setIsReconnecting(false)
      }
    })

    service.on('reconnecting', (data) => {
      setIsReconnecting(true)
      setUseDevSimulation(data.useDevSimulation)
    })

    service.on('inspection', (data) => {
      setCurrentInspection(data)
      setHistory(prev => [data, ...prev].slice(0, MAX_HISTORY))
    })

    service.on('hardware_status', (data) => {
      setHardwareStatus(data.hardware)
    })

    service.on('running_status', (data) => {
      setRunningStatus(data)
    })

    // Connect
    service.connect()

    // Cleanup
    return () => {
      service.disconnect()
    }
  }, [lineId, options.maxReconnectAttempts, options.useDevSimulation])

  /**
   * Confirm inspection with operator decision
   */
  const confirmInspection = useCallback(async (operatorDecision, options = {}) => {
    if (!currentInspection || !serviceRef.current) {
      return { success: false, error: 'No inspection to confirm' }
    }

    setIsConfirming(true)

    try {
      const result = await serviceRef.current.postConfirm(
        currentInspection.inspection_id,
        operatorDecision,
        currentInspection.decision,
        options
      )

      if (result.success) {
        setLastConfirmation({
          ...result.data,
          timestamp: new Date().toISOString()
        })
        
        // Clear current inspection after confirmation
        setCurrentInspection(null)
      }

      return result
    } finally {
      setIsConfirming(false)
    }
  }, [currentInspection])

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect()
      serviceRef.current.connect()
    }
  }, [])

  return {
    // Connection
    isConnected,
    isReconnecting,
    connectionError,
    useDevSimulation,
    reconnect,
    
    // Inspection
    currentInspection,
    history,
    
    // Hardware
    hardwareStatus,
    runningStatus,
    
    // Actions
    confirmInspection,
    isConfirming,
    lastConfirmation,
    
    // Service (for advanced usage)
    service: serviceRef.current
  }
}

export default useLiveInspection
```

---

## Task 3: Create Hardware Status Panel

### 3.1 `components/inspection/HardwareStatusPanel.jsx`

```javascript
/**
 * Hardware Status Panel
 * Displays camera and PLC status from SSE hardware_status event
 */

'use client'

import { cn } from '@/lib/utils'
import { Camera, Cpu, AlertCircle } from 'lucide-react'

export default function HardwareStatusPanel({ hardwareStatus, className }) {
  if (!hardwareStatus) {
    return (
      <div className={cn("bg-indusia-surface p-4 rounded-lg", className)}>
        <div className="flex items-center gap-2 text-indusia-textMuted">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Waiting for hardware status...</span>
        </div>
      </div>
    )
  }

  const { cameras = [], plcs = [] } = hardwareStatus

  const allOnline = [...cameras, ...plcs].every(d => d.status === 'ONLINE')

  return (
    <div className={cn("bg-indusia-surface p-4 rounded-lg", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-indusia-text">Hardware Status</h3>
        <StatusIndicator online={allOnline} />
      </div>

      {/* Cameras */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm text-indusia-textMuted mb-2">
          <Camera className="w-4 h-4" />
          <span>Cameras</span>
        </div>
        <div className="space-y-1">
          {cameras.map(cam => (
            <DeviceRow key={cam.id} device={cam} />
          ))}
        </div>
      </div>

      {/* PLCs */}
      <div>
        <div className="flex items-center gap-2 text-sm text-indusia-textMuted mb-2">
          <Cpu className="w-4 h-4" />
          <span>PLCs</span>
        </div>
        <div className="space-y-1">
          {plcs.map(plc => (
            <DeviceRow key={plc.id} device={plc} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DeviceRow({ device }) {
  const isOnline = device.status === 'ONLINE'
  
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-indusia-text">{device.name}</span>
      <div className="flex items-center gap-2">
        {device.message && (
          <span className="text-xs text-red-400">{device.message}</span>
        )}
        <StatusBadge status={device.status} />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const isOnline = status === 'ONLINE'
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-xs font-medium",
      isOnline ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
    )}>
      {status}
    </span>
  )
}

function StatusIndicator({ online }) {
  return (
    <div className={cn(
      "w-3 h-3 rounded-full",
      online ? "bg-green-500" : "bg-red-500",
      online ? "" : "animate-pulse"
    )} />
  )
}
```

---

## Task 4: Create Running Status Panel

### 4.1 `components/inspection/RunningStatusPanel.jsx`

```javascript
/**
 * Running Status Panel
 * Displays conveyor stage progress from SSE running_status event
 */

'use client'

import { cn } from '@/lib/utils'
import { Activity, CheckCircle, Circle } from 'lucide-react'

const STAGE_LABELS = {
  'unit_comming': 'Unit Coming',
  'unit_coming': 'Unit Coming',
  'camera_position_1': 'Camera Position 1',
  'camera_position_2': 'Camera Position 2',
  'pcb_flipping': 'PCB Flipping',
  'done': 'Done'
}

export default function RunningStatusPanel({ runningStatus, stages, className }) {
  if (!runningStatus) {
    return (
      <div className={cn("bg-indusia-surface p-4 rounded-lg", className)}>
        <div className="flex items-center gap-2 text-indusia-textMuted">
          <Activity className="w-4 h-4" />
          <span className="text-sm">Waiting for conveyor status...</span>
        </div>
      </div>
    )
  }

  const { stage_name, stage_id, completed } = runningStatus

  return (
    <div className={cn("bg-indusia-surface p-4 rounded-lg", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-indusia-text">Conveyor Status</h3>
        <Activity className={cn(
          "w-4 h-4",
          completed ? "text-green-400" : "text-yellow-400 animate-pulse"
        )} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-indusia-textMuted">Current Stage</span>
          <span className="text-indusia-primary font-medium">
            {STAGE_LABELS[stage_name] || stage_name}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-indusia-textMuted">Stage ID</span>
          <span className="font-mono text-xs text-indusia-text">{stage_id}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-indusia-textMuted">Status</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            completed ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
          )}>
            {completed ? 'COMPLETED' : 'IN PROGRESS'}
          </span>
        </div>
      </div>

      {/* Stage Progress (if stages available) */}
      {stages && stages.length > 0 && (
        <div className="mt-4 pt-3 border-t border-indusia-border">
          <div className="flex items-center gap-1">
            {stages.map((stage, i) => (
              <StageIndicator 
                key={stage.stage_id} 
                stage={stage}
                isCurrent={stage.stage_id === stage_id}
                isLast={i === stages.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StageIndicator({ stage, isCurrent, isLast }) {
  return (
    <>
      <div className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center",
        stage.completed ? "bg-green-500" : isCurrent ? "bg-yellow-500" : "bg-indusia-border"
      )}>
        {stage.completed ? (
          <CheckCircle className="w-3 h-3 text-white" />
        ) : (
          <Circle className={cn(
            "w-2 h-2",
            isCurrent ? "text-white" : "text-indusia-textMuted"
          )} />
        )}
      </div>
      {!isLast && (
        <div className={cn(
          "flex-1 h-0.5",
          stage.completed ? "bg-green-500" : "bg-indusia-border"
        )} />
      )}
    </>
  )
}
```

---

## Task 5: Create Connection Status Indicator

### 5.1 `components/inspection/ConnectionStatus.jsx`

```javascript
/**
 * Connection Status Indicator
 * Shows SSE connection state with reconnection info
 */

'use client'

import { cn } from '@/lib/utils'
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

export default function ConnectionStatus({ 
  isConnected, 
  isReconnecting, 
  useDevSimulation,
  error,
  onReconnect,
  className 
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
      isConnected 
        ? "bg-green-500/20 text-green-400"
        : isReconnecting
          ? "bg-yellow-500/20 text-yellow-400"
          : "bg-red-500/20 text-red-400",
      className
    )}>
      {isConnected ? (
        <>
          <Wifi className="w-3 h-3" />
          <span>Connected</span>
          {useDevSimulation && (
            <span className="text-yellow-400">(Dev)</span>
          )}
        </>
      ) : isReconnecting ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Disconnected</span>
          {onReconnect && (
            <button 
              onClick={onReconnect}
              className="ml-1 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </>
      )}
      
      {error && !isReconnecting && (
        <div className="flex items-center gap-1 ml-2 text-red-400">
          <AlertTriangle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
```

---

## Task 6: Update Environment Variables

### 6.1 `.env.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key

# AI Backend URLs (external Python/FastAPI server)
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8001/sse

# Set to 'true' to force dev simulation mode
NEXT_PUBLIC_USE_DEV_SIMULATION=false
```

---

## Task 7: Integrate into LiveView

### 7.1 Update `components/inspection/LiveViewV3.jsx`

```javascript
'use client'

import { useLiveInspection } from '@/hooks/useLiveInspection'
import HardwareStatusPanel from './HardwareStatusPanel'
import RunningStatusPanel from './RunningStatusPanel'
import ConnectionStatus from './ConnectionStatus'
import BoardOverview from './BoardOverview'
import DefectView from './DefectView'
import OperatorButtons from './OperatorButtons'

export default function LiveViewV3({ lineId, workOrder }) {
  const {
    // Connection
    isConnected,
    isReconnecting,
    connectionError,
    useDevSimulation,
    reconnect,
    
    // Inspection
    currentInspection,
    
    // Hardware
    hardwareStatus,
    runningStatus,
    
    // Actions
    confirmInspection,
    isConfirming,
    lastConfirmation
  } = useLiveInspection(lineId)

  // Handle operator decision
  const handleDecision = async (decision) => {
    const result = await confirmInspection(decision, {
      unitId: workOrder?.current_unit_id,
      comment: null
    })
    
    if (result.success) {
      console.log('Confirmed:', result.data)
      // Handle success (e.g., update WO counters)
    } else {
      console.error('Confirm failed:', result.error)
      // Handle error
    }
  }

  return (
    <div className="h-screen flex flex-col bg-indusia-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-indusia-surface border-b border-indusia-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-indusia-text">
            Live Inspection - {lineId}
          </h1>
          <ConnectionStatus
            isConnected={isConnected}
            isReconnecting={isReconnecting}
            useDevSimulation={useDevSimulation}
            error={connectionError}
            onReconnect={reconnect}
          />
        </div>
        
        {workOrder && (
          <div className="text-sm text-indusia-textMuted">
            WO: {workOrder.wo_number}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left: Images */}
        <div className="col-span-8 flex flex-col gap-4">
          <div className="flex-1 bg-indusia-surface rounded-lg overflow-hidden">
            <BoardOverview 
              inspection={currentInspection}
              side="top"
            />
          </div>
          <div className="h-48 bg-indusia-surface rounded-lg overflow-hidden">
            <DefectView 
              inspection={currentInspection}
            />
          </div>
        </div>

        {/* Right: Status & Controls */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* AI Decision */}
          {currentInspection && (
            <div className="bg-indusia-surface p-4 rounded-lg">
              <h3 className="text-sm text-indusia-textMuted mb-2">AI Decision</h3>
              <div className={cn(
                "text-2xl font-bold",
                currentInspection.decision === 'PASS' 
                  ? "text-green-400" 
                  : "text-red-400"
              )}>
                {currentInspection.decision}
              </div>
            </div>
          )}

          {/* Operator Buttons */}
          <OperatorButtons
            onGood={() => handleDecision('GOOD')}
            onNG={() => handleDecision('NG')}
            disabled={!currentInspection || isConfirming}
            isLoading={isConfirming}
            aiDecision={currentInspection?.decision}
          />

          {/* Hardware Status */}
          <HardwareStatusPanel hardwareStatus={hardwareStatus} />

          {/* Running Status */}
          <RunningStatusPanel runningStatus={runningStatus} />
        </div>
      </div>
    </div>
  )
}
```

---

## Verification Checklist

### AI Backend Service
- [ ] `lib/services/aiBackendService.js` created
- [ ] SSEConnection class with auto-reconnect
- [ ] Exponential backoff with jitter
- [ ] Fallback to dev simulation
- [ ] `postConfirm()` function
- [ ] `getStages()` function
- [ ] Transform layer (GOOD/NG ↔ is_actual_ng)

### Hook
- [ ] `useLiveInspection` updated with service integration
- [ ] Connection state management
- [ ] `confirmInspection()` function
- [ ] Manual reconnect function

### Components
- [ ] `HardwareStatusPanel` component
- [ ] `RunningStatusPanel` component
- [ ] `ConnectionStatus` component
- [ ] LiveView integration

### Environment
- [ ] `.env.example` updated
- [ ] AI Backend URLs configurable
- [ ] Dev simulation toggle

---

## Usage Examples

### Basic Usage

```javascript
// In a component
const { 
  currentInspection, 
  confirmInspection,
  isConnected 
} = useLiveInspection('line-1')

// Confirm with GOOD
await confirmInspection('GOOD')

// Confirm with NG
await confirmInspection('NG', { comment: 'Defect confirmed' })
```

### Manual Service Usage

```javascript
import { createAiBackendService } from '@/lib/services/aiBackendService'

const service = createAiBackendService('line-1')

// Connect to SSE
service.connect()

// Listen for events
service.on('inspection', (data) => {
  console.log('Inspection:', data)
})

// POST confirm
const result = await service.postConfirm('insp-123', 'GOOD', 'PASS')
console.log('Is false call:', result.data.is_false_call) // true if AI=PASS, Op=NG

// Disconnect
service.disconnect()
```

### Decision Matrix

| AI Decision | Operator | is_actual_ng | is_false_call |
|-------------|----------|--------------|---------------|
| PASS | GOOD | false | false |
| PASS | NG | true | **true** |
| FAIL | GOOD | false | **true** |
| FAIL | NG | true | false |

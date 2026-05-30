# Phase 12: SSE Consumer & AI Backend Client

## Objective
1. Create AI Backend client service for SSE connection and REST calls
2. Update Next.js UI to consume all SSE event types
3. Implement POST /confirm to AI Backend
4. Handle reconnection with user-friendly error messages

---

## Context

AI Backend (separate Python/FastAPI project at `indusia-ai-backend`) streams SSE events and handles PLC control. This Next.js UI needs to:
1. Connect to AI Backend SSE endpoint (external server at port 8001)
2. Handle all event types: `inspection`, `hardware_status`, `running_status`, `session_update`
3. Send operator confirmation via POST /confirm
4. Auto-reconnect on connection loss
5. Show clear error message when AI Backend is unavailable

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
│  │                 │   • session_update        │                 │          │
│  │                 │                           │                 │          │
│  │                 │◀───────────────────────── │                 │          │
│  │                 │   POST /confirm           │  aiBackendSvc   │          │
│  │                 │   POST /session/*         │                 │          │
│  │                 │   GET /stages             │                 │          │
│  └─────────────────┘                           └─────────────────┘          │
│                                                                             │
│  NOTE: AI Backend MUST be running before using LiveView.                    │
│  Start: cd indusia-ai-backend && uvicorn app.main:app --port 8001           │
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

// 4. session_update
{
  "session_id": "sess-abc123",
  "status": "RUNNING",
  "work_order_id": "wo-001",
  "work_order_number": "WO-2026-001",
  "line_id": "line-01",
  "inspected_count": 15,
  "lot_size": 100,
  "current_side": "top"
}
```

### REST Endpoints

```javascript
// GET /stages
{
  "status_id": "stages-20260103-001",
  "timestamp": "...",
  "stages": [
    { "stage_id": "stage-01", "name": "unit_coming", "completed": true, "timestamp": "..." },
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

// POST /session/start
// Request:
{
  "work_order_id": "wo-001",
  "work_order_number": "WO-2026-001",
  "line_id": "line-01",
  "line_name": "SMT-01",
  "board_id": "board-001",
  "board_name": "PCB-TypeA",
  "lot_size": 100,
  "side_count": 2
}
// Response:
{
  "success": true,
  "message": "Session started. Ready to run.",
  "session": { ... }
}

// POST /session/run, /session/pause, /session/stop
// Response:
{
  "success": true,
  "message": "...",
  "session": { ... }
}
```

---

## Task 1: AI Backend Client Service

### File: `lib/services/aiBackendService.js`

```javascript
/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to AI Backend (indusia-ai-backend)
 */

const AI_BACKEND_URL = process.env.NEXT_PUBLIC_AI_BACKEND_URL || 'http://localhost:8001'
const AI_BACKEND_SSE_URL = process.env.NEXT_PUBLIC_AI_BACKEND_SSE_URL || `${AI_BACKEND_URL}/sse`

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
 * Connects to external AI Backend at port 8001
 */
export class SSEConnection {
  constructor(lineId, options = {}) {
    this.lineId = lineId
    this.eventSource = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10
    this.baseDelay = options.baseDelay || 1000
    this.maxDelay = options.maxDelay || 30000
    this.reconnectTimeoutId = null
    
    this.listeners = {
      inspection: [],
      hardware_status: [],
      running_status: [],
      session_update: [],
      connected: [],
      error: [],
      reconnecting: [],
      heartbeat: []
    }
  }

  /**
   * Get SSE URL
   */
  getSSEUrl() {
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
        console.log('[SSE] Connected to AI Backend')
        this.reconnectAttempts = 0
        this._emit('connected', { url, timestamp: new Date().toISOString() })
      }

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        this._emit('error', { 
          error, 
          timestamp: new Date().toISOString(),
          message: 'Connection to AI Backend failed'
        })
        this._handleReconnect()
      }

      // Register event listeners
      this._registerEventListener('inspection')
      this._registerEventListener('hardware_status')
      this._registerEventListener('running_status')
      this._registerEventListener('session_update')
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
    if (!this.eventSource) return
    
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
    // Clear any pending reconnect
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      this._emit('error', { 
        message: 'AI Backend tidak tersedia. Jalankan: cd indusia-ai-backend && uvicorn app.main:app --port 8001',
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
    console.log(`[SSE] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`)
    
    this._emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      delay: Math.round(delay)
    })

    this.reconnectTimeoutId = setTimeout(() => this.connect(), delay)
  }

  /**
   * Disconnect SSE
   */
  disconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    
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
      this.listeners[eventType].forEach(cb => {
        try {
          cb(data)
        } catch (err) {
          console.error(`[SSE] Listener error for ${eventType}:`, err)
        }
      })
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
 */
export async function postConfirm(inspectionId, operatorDecision, aiDecision, options = {}) {
  const { unitId, comment } = options
  
  // Calculate false call
  const isFalseCall = calculateFalseCall(aiDecision, operatorDecision)
  
  // Transform to AI Backend format
  const payload = {
    inspection_id: inspectionId,
    ...toAiBackendFormat(operatorDecision),
    ...(unitId && { unit_id: unitId }),
    ...(comment && { comment })
  }

  const endpoint = `${AI_BACKEND_URL}/confirm`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
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
    return {
      success: false,
      error: error.message || 'AI Backend tidak tersedia'
    }
  }
}

/**
 * GET /stages - Get conveyor stage definitions
 */
export async function getStages(options = {}) {
  const { withProgress = false } = options
  
  const endpoint = `${AI_BACKEND_URL}/stages${withProgress ? '?progress=true' : ''}`

  try {
    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('[AI Backend] GET /stages error:', error)
    return { 
      success: false, 
      error: error.message || 'AI Backend tidak tersedia'
    }
  }
}

/**
 * Check AI Backend health
 */
export async function checkHealth() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

// ============================================
// Session API Calls
// ============================================

/**
 * POST /session/start - Start new inspection session
 */
export async function startSession(sessionData) {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to start session')
    }

    return { success: true, data: data.session }
  } catch (error) {
    console.error('[AI Backend] POST /session/start error:', error)
    return { 
      success: false, 
      error: error.message || 'AI Backend tidak tersedia'
    }
  }
}

/**
 * POST /session/run - Start the inspection machine
 */
export async function runSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/run`, { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to run session')
    }

    return { success: true, data: data.session }
  } catch (error) {
    console.error('[AI Backend] POST /session/run error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * POST /session/pause - Pause the inspection machine
 */
export async function pauseSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/pause`, { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to pause session')
    }

    return { success: true, data: data.session }
  } catch (error) {
    console.error('[AI Backend] POST /session/pause error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * POST /session/stop - Stop and end session
 */
export async function stopSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/stop`, { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to stop session')
    }

    return { success: true, data: data.session }
  } catch (error) {
    console.error('[AI Backend] POST /session/stop error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * GET /session/status - Get current session status
 */
export async function getSessionStatus() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/status`)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to get session status')
    }

    return { success: true, data: data.session }
  } catch (error) {
    console.error('[AI Backend] GET /session/status error:', error)
    return { success: false, error: error.message }
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
    
    // REST - Core
    postConfirm,
    getStages,
    checkHealth,
    
    // REST - Session
    startSession,
    runSession,
    pauseSession,
    stopSession,
    getSessionStatus,
    
    // Utils
    calculateFalseCall
  }
}

export default {
  SSEConnection,
  postConfirm,
  getStages,
  checkHealth,
  startSession,
  runSession,
  pauseSession,
  stopSession,
  getSessionStatus,
  createAiBackendService,
  toAiBackendFormat,
  fromAiBackendFormat,
  calculateFalseCall
}
```

---

## Task 2: Update useLiveInspection Hook

### File: `hooks/useLiveInspection.js`

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
  
  // Inspection state
  const [currentInspection, setCurrentInspection] = useState(null)
  const [history, setHistory] = useState([])
  
  // Hardware state
  const [hardwareStatus, setHardwareStatus] = useState(null)
  const [runningStatus, setRunningStatus] = useState(null)
  
  // Session state
  const [sessionInfo, setSessionInfo] = useState(null)
  
  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false)
  const [lastConfirmation, setLastConfirmation] = useState(null)
  
  // Service ref
  const serviceRef = useRef(null)

  // Initialize service
  useEffect(() => {
    if (!lineId) return

    const service = createAiBackendService(lineId, {
      maxReconnectAttempts: options.maxReconnectAttempts || 10
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

    service.on('session_update', (data) => {
      setSessionInfo(data)
    })

    // Connect
    service.connect()

    // Cleanup
    return () => {
      service.disconnect()
    }
  }, [lineId, options.maxReconnectAttempts])

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
    reconnect,
    
    // Inspection
    currentInspection,
    history,
    
    // Hardware
    hardwareStatus,
    runningStatus,
    
    // Session
    sessionInfo,
    
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

## Task 3: Create Connection Status Component

### File: `components/inspection/ConnectionStatus.jsx`

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
          <span className="max-w-xs truncate">{error}</span>
        </div>
      )}
    </div>
  )
}
```

---

## Task 4: Update Environment Variables

### File: `.env.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key

# AI Backend URLs (external Python/FastAPI server)
# Run: cd indusia-ai-backend && uvicorn app.main:app --port 8001
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8001/sse
```

---

## Verification Checklist

### AI Backend Service
- [ ] `lib/services/aiBackendService.js` created
- [ ] SSEConnection class with auto-reconnect
- [ ] Exponential backoff with jitter
- [ ] Clear error message when AI Backend unavailable
- [ ] `postConfirm()` function
- [ ] `getStages()` function
- [ ] Session API functions (start, run, pause, stop, status)
- [ ] Transform layer (GOOD/NG ↔ is_actual_ng)

### Hook
- [ ] `useLiveInspection` updated with service integration
- [ ] Connection state management
- [ ] Session state from `session_update` event
- [ ] `confirmInspection()` function
- [ ] Manual reconnect function

### Components
- [ ] `ConnectionStatus` component

### Environment
- [ ] `.env.example` updated with AI Backend URLs
- [ ] No dev simulation references

---

## Usage Examples

### Basic Usage

```javascript
// In a component
const { 
  currentInspection, 
  confirmInspection,
  isConnected,
  connectionError
} = useLiveInspection('line-1')

// Show error if not connected
if (connectionError) {
  return <div>Error: {connectionError}</div>
}

// Confirm with GOOD
await confirmInspection('GOOD')

// Confirm with NG
await confirmInspection('NG', { comment: 'Defect confirmed' })
```

### With Session Management

```javascript
import { startSession, runSession, stopSession } from '@/lib/services/aiBackendService'

// Start session first
const sessionResult = await startSession({
  work_order_id: 'wo-001',
  work_order_number: 'WO-2026-001',
  line_id: 'line-01',
  board_id: 'board-001',
  lot_size: 100,
  side_count: 2
})

if (sessionResult.success) {
  // Then connect SSE and run
  const runResult = await runSession()
}
```

### Decision Matrix

| AI Decision | Operator | is_actual_ng | is_false_call |
|-------------|----------|--------------|---------------|
| PASS | GOOD | false | false |
| PASS | NG | true | **true** |
| FAIL | GOOD | false | **true** |
| FAIL | NG | true | false |

---

## Running the System

```bash
# Terminal 1: Start AI Backend (required)
cd C:\xampp\htdocs\indusia-ai-backend
venv\Scripts\activate
uvicorn app.main:app --port 8001 --reload

# Terminal 2: Start Next.js UI
cd C:\xampp\htdocs\indusia-ai-hmi
npm run dev

# Open:
# - Control Panel: http://localhost:8001
# - Next.js UI: http://localhost:3000
```

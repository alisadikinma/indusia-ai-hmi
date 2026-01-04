/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to AI Backend (dev.py)
 * 
 * dev.py endpoints:
 * - /events/inspection (SSE)
 * - /events/hardware-status (SSE)
 * - /events/running-status (SSE)
 * - /inspection/confirm (POST)
 * - /stages (GET)
 * 
 * @module lib/services/aiBackendService
 */

const AI_BACKEND_URL = process.env.NEXT_PUBLIC_AI_BACKEND_URL || 'http://localhost:8000'

// ============================================
// Transform Layer
// ============================================

/**
 * Convert operator decision to AI Backend format
 * UI uses: 'GOOD' / 'NG'
 * AI Backend expects: is_actual_ng (boolean)
 * 
 * @param {string} operatorDecision - 'GOOD' or 'NG'
 * @returns {object} - { is_actual_ng: boolean }
 */
export function toAiBackendFormat(operatorDecision) {
  return {
    is_actual_ng: operatorDecision === 'NG'
  }
}

/**
 * Convert AI Backend response to UI format
 * 
 * @param {object} response - AI Backend response
 * @returns {object} - Response with operator_decision added
 */
export function fromAiBackendFormat(response) {
  return {
    ...response,
    operator_decision: response.is_actual_ng ? 'NG' : 'GOOD'
  }
}

/**
 * Calculate false call based on AI decision vs Operator decision
 * False call = operator disagrees with AI
 * 
 * @param {string} aiDecision - 'PASS' or 'FAIL'
 * @param {string} operatorDecision - 'GOOD' or 'NG'
 * @returns {boolean}
 */
export function calculateFalseCall(aiDecision, operatorDecision) {
  return (
    (aiDecision === 'PASS' && operatorDecision === 'NG') ||
    (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
  )
}

// ============================================
// SSE Connection Class (Multiple Streams)
// ============================================

/**
 * SSE Connection Manager for dev.py
 * Connects to 3 separate SSE endpoints:
 * - /events/inspection
 * - /events/hardware-status
 * - /events/running-status
 */
export class SSEConnection {
  constructor(lineId, options = {}) {
    this.lineId = lineId
    this.eventSources = {}
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10
    this.baseDelay = options.baseDelay || 1000
    this.maxDelay = options.maxDelay || 30000
    this.reconnectTimeoutId = null
    this._connected = false
    
    this.listeners = {
      inspection: [],
      hardware_status: [],
      running_status: [],
      session_update: [],
      work_order_update: [],
      confirmed: [],
      connected: [],
      error: [],
      reconnecting: [],
      heartbeat: []
    }
  }

  /**
   * Connect to all SSE streams
   */
  connect() {
    this.disconnect()

    console.log(`[SSE] Connecting to AI Backend at ${AI_BACKEND_URL}`)

    try {
      // Connect to inspection events
      this._connectToStream('inspection', `${AI_BACKEND_URL}/events/inspection`)
      
      // Connect to hardware status events
      this._connectToStream('hardware_status', `${AI_BACKEND_URL}/events/hardware-status`)
      
      // Connect to running status events
      this._connectToStream('running_status', `${AI_BACKEND_URL}/events/running-status`)

      this._connected = true
      this._emit('connected', { 
        url: AI_BACKEND_URL, 
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      this._handleReconnect()
    }
  }

  /**
   * Connect to a single SSE stream
   * @param {string} name - Stream name (inspection, hardware_status, running_status)
   * @param {string} url - Stream URL
   */
  _connectToStream(name, url) {
    console.log(`[SSE] Connecting to ${name} stream: ${url}`)
    
    const eventSource = new EventSource(url)
    this.eventSources[name] = eventSource

    eventSource.onopen = () => {
      console.log(`[SSE] ${name} stream connected`)
      this.reconnectAttempts = 0
    }

    eventSource.onerror = (error) => {
      console.error(`[SSE] ${name} stream error:`, error)
      // Don't emit error for each stream, handle reconnect
    }

    // dev.py sends NAMED events (event: inspection, event: hardware_status, etc)
    // Must use addEventListener instead of onmessage for named events
    eventSource.addEventListener(name, (e) => {
      try {
        const data = JSON.parse(e.data)
        console.log(`[SSE] Received ${name} event:`, data)
        this._emit(name, data)
      } catch (err) {
        console.error(`[SSE] Failed to parse ${name} event:`, err)
      }
    })
  }

  /**
   * Handle reconnection with exponential backoff
   */
  _handleReconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      this._emit('error', { 
        message: 'AI Backend tidak tersedia. Jalankan: python app/dev.py',
        fatal: true 
      })
      return
    }

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
   * Disconnect all SSE streams
   */
  disconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    
    Object.keys(this.eventSources).forEach(name => {
      if (this.eventSources[name]) {
        this.eventSources[name].close()
        console.log(`[SSE] ${name} stream disconnected`)
      }
    })
    
    this.eventSources = {}
    this._connected = false
    console.log('[SSE] All streams disconnected')
  }

  /**
   * Add event listener
   * @param {string} eventType
   * @param {function} callback
   * @returns {function} - Unsubscribe function
   */
  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback)
    }
    return () => this.off(eventType, callback)
  }

  /**
   * Remove event listener
   * @param {string} eventType
   * @param {function} callback
   */
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback)
    }
  }

  /**
   * Emit event to listeners
   * @param {string} eventType
   * @param {*} data
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
   * @returns {boolean}
   */
  isConnected() {
    return this._connected && Object.keys(this.eventSources).length > 0
  }
}

// ============================================
// REST API Calls
// ============================================

/**
 * POST /inspection/confirm - Send operator confirmation to AI Backend
 * 
 * @param {string} inspectionId - Inspection ID from SSE event
 * @param {string} operatorDecision - 'GOOD' or 'NG'
 * @param {string} aiDecision - 'PASS' or 'FAIL' (for false call calculation)
 * @param {object} options - Additional options
 * @param {string} options.unitId - Unit ID
 * @param {string} options.comment - Comment
 * @param {string} options.falseCallReason - False call reason code
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function postConfirm(inspectionId, operatorDecision, aiDecision, options = {}) {
  const { unitId, comment, falseCallReason } = options
  
  const isFalseCall = calculateFalseCall(aiDecision, operatorDecision)
  
  const payload = {
    inspection_id: inspectionId,
    ...toAiBackendFormat(operatorDecision),
    ...(unitId && { unit_id: unitId }),
    ...(comment && { comment }),
    ...(falseCallReason && { false_call_reason: falseCallReason })
  }

  const endpoint = `${AI_BACKEND_URL}/confirm`

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
    console.error('[AI Backend] POST /inspection/confirm error:', error)
    return {
      success: false,
      error: error.message || 'AI Backend tidak tersedia'
    }
  }
}

/**
 * GET /stages - Get conveyor stage definitions
 * 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getStages() {
  const endpoint = `${AI_BACKEND_URL}/stages`

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
 * 
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    // Try to fetch stages as health check (dev.py doesn't have /health)
    const response = await fetch(`${AI_BACKEND_URL}/stages`, {
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
// Session API Calls (Stub for dev.py compatibility)
// ============================================

/**
 * Start session - stub for dev.py (no session management)
 */
export async function startSession(sessionData) {
  console.log('[AI Backend] startSession (stub):', sessionData)
  return { 
    success: true, 
    data: { 
      status: 'READY',
      work_order_id: sessionData.work_order_id
    } 
  }
}

/**
 * Run session - stub for dev.py
 */
export async function runSession() {
  console.log('[AI Backend] runSession (stub)')
  return { success: true, data: { status: 'RUNNING' } }
}

/**
 * Pause session - stub for dev.py
 */
export async function pauseSession() {
  console.log('[AI Backend] pauseSession (stub)')
  return { success: true, data: { status: 'PAUSED' } }
}

/**
 * Stop session - stub for dev.py
 */
export async function stopSession() {
  console.log('[AI Backend] stopSession (stub)')
  return { success: true, data: { status: 'STOPPED' } }
}

/**
 * Get session status - stub for dev.py
 */
export async function getSessionStatus() {
  return { success: true, data: { status: 'RUNNING' } }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create AI Backend service instance
 * 
 * @param {string} lineId
 * @param {object} options
 * @returns {object}
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
    
    // REST - Session (stubs)
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
  // Core API
  postConfirm,
  getStages,
  checkHealth,
  // Session API (stubs)
  startSession,
  runSession,
  pauseSession,
  stopSession,
  getSessionStatus,
  // Factory
  createAiBackendService,
  // Transform
  toAiBackendFormat,
  fromAiBackendFormat,
  calculateFalseCall
}

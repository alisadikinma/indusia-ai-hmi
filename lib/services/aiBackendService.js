/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to AI Backend (indusia-ai-backend)
 * 
 * @module lib/services/aiBackendService
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
// SSE Connection Class
// ============================================

/**
 * SSE Connection Manager with auto-reconnect
 * Connects to external AI Backend (indusia-ai-backend) at port 8001
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
      work_order_update: [],
      connected: [],
      error: [],
      reconnecting: [],
      heartbeat: []
    }
  }

  /**
   * Get SSE URL
   * @returns {string}
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
        this._emit('connected', { 
          url, 
          timestamp: new Date().toISOString()
        })
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
      this._registerEventListener('work_order_update')
      this._registerEventListener('heartbeat')

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      this._handleReconnect()
    }
  }

  /**
   * Register SSE event listener
   * @param {string} eventType
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
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
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
    return {
      success: false,
      error: error.message || 'AI Backend tidak tersedia'
    }
  }
}

/**
 * GET /stages - Get conveyor stage definitions
 * 
 * @param {object} options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
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
 * 
 * @returns {Promise<boolean>}
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
 * Must be called before SSE connection
 * 
 * @param {object} sessionData - Session configuration
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function startSession(sessionData) {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
 * 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function runSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/run`, {
      method: 'POST'
    })

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
 * 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function pauseSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/pause`, {
      method: 'POST'
    })

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
 * 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function stopSession() {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/session/stop`, {
      method: 'POST'
    })

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
 * 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
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
  // Core API
  postConfirm,
  getStages,
  checkHealth,
  // Session API
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

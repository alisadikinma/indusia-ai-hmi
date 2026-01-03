/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to AI Backend
 * 
 * @module lib/services/aiBackendService
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
    this.reconnectTimeoutId = null
    
    this.listeners = {
      inspection: [],
      hardware_status: [],
      running_status: [],
      connected: [],
      error: [],
      reconnecting: [],
      heartbeat: []
    }
  }

  /**
   * Get SSE URL based on environment
   * @returns {string}
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
        this._emit('connected', { 
          url, 
          timestamp: new Date().toISOString(),
          useDevSimulation: this.useDevSimulation
        })
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
    console.log(`[SSE] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`)
    
    this._emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      delay: Math.round(delay),
      useDevSimulation: this.useDevSimulation
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
 * 
 * @param {object} options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
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
    
    // REST
    postConfirm: (inspectionId, operatorDecision, aiDecision, opts) => 
      postConfirm(inspectionId, operatorDecision, aiDecision, { 
        ...opts, 
        useDev: connection.useDevSimulation 
      }),
    getStages: (opts) => getStages({ ...opts, useDev: connection.useDevSimulation }),
    
    // Utils
    calculateFalseCall,
    checkHealth,
    
    // State
    getUseDevSimulation: () => connection.useDevSimulation
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

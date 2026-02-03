/**
 * AI Backend Client Service
 * Handles SSE connection and REST calls to Auto Inspect Edge
 *
 * Auto Inspect Edge API (python -m auto_inspect_edge.main):
 * - /api/inspection/start (POST)
 * - /api/inspection/pause (POST)
 * - /api/inspection/resume (POST)
 * - /api/inspection/stop (POST)
 * - /api/model/list (GET)
 * - /api/model/select/{model_name} (POST)
 * - /api/model/current (GET)
 * - /api/model/stages (GET)
 * - /api/model/events/inspection (SSE)
 * - /api/model/events/motion_stages (SSE)
 * - /api/model/events/vision_stages (SSE)
 * - /api/model/events/device_status (SSE)
 * - /health (GET)
 *
 * @module lib/services/aiBackendService
 */

const AI_BACKEND_URL = process.env.NEXT_PUBLIC_AI_BACKEND_URL || 'http://localhost:8002'

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
 * SSE Connection Manager for Auto Inspect Edge
 * Connects to 4 separate SSE endpoints:
 * - /api/model/events/inspection
 * - /api/model/events/motion_stages
 * - /api/model/events/vision_stages
 * - /api/model/events/device_status
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
      motion_stages: [],
      vision_stages: [],
      device_status: [],
      connected: [],
      error: [],
      reconnecting: []
    }

    this._lastEventTime = {}
  }

  /**
   * Connect to all SSE streams
   */
  connect() {
    this.disconnect()

    console.log(`[SSE] ========================================`)
    console.log(`[SSE] Connecting to Auto Inspect Edge at ${AI_BACKEND_URL}`)
    console.log(`[SSE] ========================================`)

    try {
      // Connect to inspection results stream
      console.log(`[SSE] 1️⃣ Creating INSPECTION stream...`)
      this._connectToStream('inspection', `${AI_BACKEND_URL}/api/model/events/inspection`)

      // Connect to motion stages stream
      console.log(`[SSE] 2️⃣ Creating MOTION_STAGES stream...`)
      this._connectToStream('motion_stages', `${AI_BACKEND_URL}/api/model/events/motion_stages`)

      // Connect to vision stages stream
      console.log(`[SSE] 3️⃣ Creating VISION_STAGES stream...`)
      this._connectToStream('vision_stages', `${AI_BACKEND_URL}/api/model/events/vision_stages`)

      // Connect to device status stream
      console.log(`[SSE] 4️⃣ Creating DEVICE_STATUS stream...`)
      this._connectToStream('device_status', `${AI_BACKEND_URL}/api/model/events/device_status`)

      this._connected = true
      this._emit('connected', {
        url: AI_BACKEND_URL,
        timestamp: new Date().toISOString(),
        streams: Object.keys(this.eventSources)
      })

      // Log connection status after 2 seconds
      setTimeout(() => {
        console.log(`[SSE] ========================================`)
        console.log(`[SSE] CONNECTION STATUS CHECK:`)
        Object.entries(this.eventSources).forEach(([name, es]) => {
          const states = ['CONNECTING', 'OPEN', 'CLOSED']
          console.log(`[SSE]   ${name}: ${states[es.readyState]} (${es.readyState})`)
        })
        console.log(`[SSE] ========================================`)
      }, 2000)

      // Start periodic health check for critical streams
      this._startHealthCheck()

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      this._handleReconnect()
    }
  }

  /**
   * Connect to a single SSE stream
   * @param {string} name - Stream name
   * @param {string} url - Stream URL
   */
  _connectToStream(name, url) {
    console.log(`[SSE] Connecting to ${name} stream: ${url}`)

    // Track last event time for this stream
    if (!this._lastEventTime) this._lastEventTime = {}
    this._lastEventTime[name] = Date.now()

    try {
      // Close existing stream if any
      if (this.eventSources[name]) {
        this.eventSources[name].close()
      }

      const eventSource = new EventSource(url)
      this.eventSources[name] = eventSource

      eventSource.onopen = () => {
        console.log(`[SSE] ✅ ${name} stream CONNECTED`)
        this.reconnectAttempts = 0
        this._lastEventTime[name] = Date.now()
      }

      eventSource.onerror = (error) => {
        console.error(`[SSE] ❌ ${name} stream ERROR:`, error)
        console.error(`[SSE] ${name} readyState:`, eventSource.readyState)

        // Auto-reconnect individual stream if closed
        if (eventSource.readyState === 2) {
          console.log(`[SSE] 🔄 Auto-reconnecting ${name} stream in 2s...`)
          setTimeout(() => {
            if (this._connected && this.eventSources[name]?.readyState === 2) {
              console.log(`[SSE] 🔄 Reconnecting ${name} stream now...`)
              this._connectToStream(name, url)
            }
          }, 2000)
        }
      }

      // Handler for incoming SSE data
      const handleEvent = (e) => {
        this._lastEventTime[name] = Date.now()
        try {
          console.log(`[SSE] 📩 RAW ${name} event received:`, e.data?.substring(0, 200))
          const data = JSON.parse(e.data)
          console.log(`[SSE] ✅ Parsed ${name} event:`, data)
          this._emit(name, data)
        } catch (err) {
          console.error(`[SSE] ❌ Failed to parse ${name} event:`, err, e.data)
        }
      }

      // Listen for named events (event: <name>\ndata: {...})
      eventSource.addEventListener(name, handleEvent)

      // Fallback: handle default message events (data: {...} without event: field)
      eventSource.onmessage = handleEvent
    } catch (err) {
      console.error(`[SSE] ❌ Failed to create EventSource for ${name}:`, err)
    }
  }

  /**
   * Start periodic health check
   */
  _startHealthCheck() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval)
    }

    const STALE_THRESHOLD_MS = 60000 // 60 seconds without events = stale

    this._healthCheckInterval = setInterval(() => {
      if (!this._connected) return

      const now = Date.now()

      // Check inspection stream health (most critical)
      const inspectionStream = this.eventSources['inspection']
      if (!inspectionStream || inspectionStream.readyState === 2) {
        console.warn('[SSE] ⚠️ HEALTH CHECK: Inspection stream CLOSED! Reconnecting...')
        this._connectToStream('inspection', `${AI_BACKEND_URL}/api/model/events/inspection`)
      } else if (inspectionStream.readyState === 0) {
        console.warn('[SSE] ⚠️ HEALTH CHECK: Inspection stream still CONNECTING...')
      }

      // Log status
      const states = ['CONNECTING', 'OPEN', 'CLOSED']
      const inspLastEvent = this._lastEventTime?.['inspection'] ? Math.round((now - this._lastEventTime['inspection'])/1000) : 'N/A'

      console.log('[SSE] 🩺 Health check:', {
        inspection: inspectionStream ? `${states[inspectionStream.readyState]} (${inspLastEvent}s ago)` : 'MISSING'
      })

    }, 15000) // Check every 15 seconds
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
        message: 'AI Backend tidak tersedia. Jalankan: python -m auto_inspect_edge.main',
        fatal: true
      })
      return
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxDelay
    )

    this.reconnectAttempts++
    console.log(`[SSE] 🔄 Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

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
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval)
      this._healthCheckInterval = null
    }

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
   * Get status of all SSE streams
   * @returns {object} - Stream status map
   */
  getStreamStatus() {
    const states = ['CONNECTING', 'OPEN', 'CLOSED']
    const status = {}

    Object.entries(this.eventSources).forEach(([name, es]) => {
      status[name] = {
        readyState: es.readyState,
        status: states[es.readyState] || 'UNKNOWN',
        isOpen: es.readyState === 1
      }
    })

    // Check if inspection stream is missing or closed
    if (!status.inspection || status.inspection.readyState === 2) {
      console.warn('[SSE] ⚠️ Inspection stream not available!')
    }

    return status
  }

  /**
   * Check if all critical streams are connected
   * @returns {boolean}
   */
  areStreamsHealthy() {
    const status = this.getStreamStatus()
    const inspectionOk = status.inspection?.isOpen

    if (!inspectionOk) {
      console.warn('[SSE] ⚠️ Inspection stream unhealthy - results will not arrive!')
    }

    return inspectionOk
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
// Inspection Control API
// ============================================

/**
 * POST /api/inspection/start - Start inspection process
 * @param {object} options - Start options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function startInspection(options = {}) {
  const { reason } = options
  const endpoint = `${AI_BACKEND_URL}/api/inspection/start${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`

  try {
    const response = await fetch(endpoint, { method: 'POST' })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log('[AI Backend] Inspection started:', data)
    return { success: data.success || true, data }
  } catch (error) {
    console.error('[AI Backend] POST /api/inspection/start error:', error)
    return {
      success: false,
      error: error.message || 'Failed to start inspection'
    }
  }
}

/**
 * POST /api/inspection/pause - Pause inspection process
 * @param {object} options - Pause options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function pauseInspection(options = {}) {
  const { reason } = options
  const endpoint = `${AI_BACKEND_URL}/api/inspection/pause${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`

  try {
    const response = await fetch(endpoint, { method: 'POST' })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log('[AI Backend] Inspection paused:', data)
    return { success: data.success || true, data }
  } catch (error) {
    console.error('[AI Backend] POST /api/inspection/pause error:', error)
    return {
      success: false,
      error: error.message || 'Failed to pause inspection'
    }
  }
}

/**
 * POST /api/inspection/resume - Resume inspection process
 * @param {object} options - Resume options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function resumeInspection(options = {}) {
  const { reason } = options
  const endpoint = `${AI_BACKEND_URL}/api/inspection/resume${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`

  try {
    const response = await fetch(endpoint, { method: 'POST' })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log('[AI Backend] Inspection resumed:', data)
    return { success: data.success || true, data }
  } catch (error) {
    console.error('[AI Backend] POST /api/inspection/resume error:', error)
    return {
      success: false,
      error: error.message || 'Failed to resume inspection'
    }
  }
}

/**
 * POST /api/inspection/stop - Stop inspection process
 * @param {object} options - Stop options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function stopInspection(options = {}) {
  const { reason } = options
  const endpoint = `${AI_BACKEND_URL}/api/inspection/stop${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`

  try {
    const response = await fetch(endpoint, { method: 'POST' })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log('[AI Backend] Inspection stopped:', data)
    return { success: data.success || true, data }
  } catch (error) {
    console.error('[AI Backend] POST /api/inspection/stop error:', error)
    return {
      success: false,
      error: error.message || 'Failed to stop inspection'
    }
  }
}

// ============================================
// Model Management API
// ============================================

/**
 * GET /api/model/list - List available models
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function listModels() {
  const endpoint = `${AI_BACKEND_URL}/api/model/list`

  try {
    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    return { success: result.status || true, data: result.data }
  } catch (error) {
    console.error('[AI Backend] GET /api/model/list error:', error)
    return {
      success: false,
      error: error.message || 'Failed to list models'
    }
  }
}

/**
 * POST /api/model/select/{model_name} - Select and load model
 * @param {string} modelName - Model name to select
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function selectModel(modelName) {
  const endpoint = `${AI_BACKEND_URL}/api/model/select/${encodeURIComponent(modelName)}`

  try {
    const response = await fetch(endpoint, { method: 'POST' })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // FastAPI uses 'detail' field, not 'message'
      const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    const result = await response.json()
    console.log('[AI Backend] Model selected:', result)
    return { success: result.status || true, data: result.data }
  } catch (error) {
    console.error('[AI Backend] POST /api/model/select error:', error)
    return {
      success: false,
      error: error.message || 'Failed to select model'
    }
  }
}

/**
 * GET /api/model/current - Get current selected model
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getCurrentModel() {
  const endpoint = `${AI_BACKEND_URL}/api/model/current`

  try {
    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    return { success: result.status || true, data: result.data }
  } catch (error) {
    console.error('[AI Backend] GET /api/model/current error:', error)
    return {
      success: false,
      error: error.message || 'Failed to get current model'
    }
  }
}

// ============================================
// Stage API
// ============================================

/**
 * GET /api/model/stages - Get inspection stage list
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getStages() {
  const endpoint = `${AI_BACKEND_URL}/api/model/stages`

  try {
    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('[AI Backend] GET /api/model/stages error:', error)
    return {
      success: false,
      error: error.message || 'Failed to get stages'
    }
  }
}

// ============================================
// Simulation Helper
// ============================================

/**
 * POST /serial/sim/in - Trigger PLC READY signal (simulation mode only)
 * In production, PLC sends READY automatically when a new board arrives.
 * In simulation mode, this must be called to start the next inspection cycle.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function triggerSimReady() {
  const endpoint = `${AI_BACKEND_URL}/serial/sim/in`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'READY' })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`)
    }

    console.log('[AI Backend] Simulation READY triggered for next cycle')
    return { success: true }
  } catch (error) {
    // Silently fail - endpoint only exists in simulation mode
    console.warn('[AI Backend] triggerSimReady unavailable (OK in production):', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * GET /health - Check AI Backend health
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

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
    getStreamStatus: () => connection.getStreamStatus(),
    areStreamsHealthy: () => connection.areStreamsHealthy(),

    // Inspection Control
    startInspection,
    pauseInspection,
    resumeInspection,
    stopInspection,

    // Model Management
    listModels,
    selectModel,
    getCurrentModel,

    // Core API
    getStages,
    triggerSimReady,
    checkHealth,

    // Utils
    calculateFalseCall
  }
}

export default {
  SSEConnection,
  // Inspection Control
  startInspection,
  pauseInspection,
  resumeInspection,
  stopInspection,
  // Model Management
  listModels,
  selectModel,
  getCurrentModel,
  // Core
  getStages,
  triggerSimReady,
  checkHealth,
  // Factory
  createAiBackendService,
  // Transform
  toAiBackendFormat,
  fromAiBackendFormat,
  calculateFalseCall
}

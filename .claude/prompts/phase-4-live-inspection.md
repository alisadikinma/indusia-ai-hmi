# Phase 4: Live Inspection View — Real-time Detection Overlay

## Objective
Implement live camera feed with real-time AI detection overlay dan integration dengan Override system.

---

## Context

Database ready:
- `inspection_frames` — logging setiap frame inspection
- `inspection_stats` — aggregated stats per shift

Dependencies:
- Phase 3 (OverrideModal) untuk false call submission
- WebSocket atau SSE untuk real-time data

Tech stack: Next.js 14 App Router, JavaScript, Canvas API, SSE/WebSocket

---

## Architecture Overview

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Edge Device    │  SSE    │   Next.js API    │  Hook   │   React Client   │
│  (Camera + GPU)  │ ──────► │  /api/live/[id]  │ ──────► │   LiveView.jsx   │
│                  │         │                  │         │                  │
│  - Camera feed   │         │  - Parse events  │         │  - Canvas overlay│
│  - YOLO inference│         │  - Forward to    │         │  - Detection log │
│  - Send results  │         │    client        │         │  - Override btn  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

**Note:** Edge device integration adalah tahap selanjutnya. Phase ini fokus pada:
1. SSE endpoint untuk menerima data
2. Frontend components untuk display
3. Mock data untuk testing

---

## Task 1: Create SSE API Endpoint

### 1.1 `app/api/live/[lineId]/route.js`

```javascript
// Server-Sent Events endpoint for live inspection data

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory store for connected clients per line
const clients = new Map()

export async function GET(request, { params }) {
  const { lineId } = params
  
  // Setup SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      if (!clients.has(lineId)) {
        clients.set(lineId, new Set())
      }
      
      const clientId = Date.now().toString()
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      
      clients.get(lineId).add({ id: clientId, send })
      
      // Send initial connection message
      send({ type: 'connected', lineId, clientId })
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        const lineClients = clients.get(lineId)
        if (lineClients) {
          const client = [...lineClients].find(c => c.id === clientId)
          if (client) lineClients.delete(client)
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// POST endpoint for edge device to push detection results
export async function POST(request, { params }) {
  const { lineId } = params
  const body = await request.json()
  
  // Validate API key (edge device authentication)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.EDGE_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Broadcast to all connected clients for this line
  const lineClients = clients.get(lineId)
  if (lineClients) {
    const data = {
      type: 'detection',
      frame_id: body.frame_id,
      timestamp: body.timestamp || new Date().toISOString(),
      board_id: body.board_id,
      image_url: body.image_url, // URL to frame image
      detections: body.detections || [],
      inference_ms: body.inference_ms,
      result: body.result // 'pass', 'fail', 'review'
    }
    
    lineClients.forEach(client => {
      try {
        client.send(data)
      } catch (err) {
        console.error('Failed to send to client:', err)
      }
    })
  }
  
  // Optionally log to database (inspection_frames)
  // await logInspectionFrame(lineId, body)
  
  return Response.json({ success: true, clients: lineClients?.size || 0 })
}

// Helper to broadcast from other parts of app
export function broadcastToLine(lineId, data) {
  const lineClients = clients.get(lineId)
  if (lineClients) {
    lineClients.forEach(client => client.send(data))
  }
}
```

### 1.2 `lib/repos/inspectionFramesRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const inspectionFramesRepo = {
  async log({ line_id, board_id, frame_timestamp, image_path, detections, inference_ms, result }) {
    return supabase
      .from('inspection_frames')
      .insert({
        line_id,
        board_id,
        frame_timestamp: frame_timestamp || new Date().toISOString(),
        image_path,
        detections,
        inference_ms,
        result
      })
      .select()
      .single()
  },

  async getRecent(line_id, limit = 50) {
    return supabase
      .from('inspection_frames')
      .select('*')
      .eq('line_id', line_id)
      .order('frame_timestamp', { ascending: false })
      .limit(limit)
  },

  async getByResult(line_id, result, limit = 20) {
    return supabase
      .from('inspection_frames')
      .select('*')
      .eq('line_id', line_id)
      .eq('result', result)
      .order('frame_timestamp', { ascending: false })
      .limit(limit)
  },

  async getStats(line_id, since) {
    const query = supabase
      .from('inspection_frames')
      .select('result', { count: 'exact' })
      .eq('line_id', line_id)
    
    if (since) {
      query.gte('frame_timestamp', since)
    }
    
    return query
  }
}
```

---

## Task 2: Create Live Inspection Hook

### 2.1 `hooks/useLiveInspection.js`

```javascript
import { useState, useEffect, useRef, useCallback } from 'react'

export function useLiveInspection(lineId, options = {}) {
  const {
    onDetection,
    maxLogSize = 100,
    autoReconnect = true,
    reconnectDelay = 3000
  } = options

  const [connected, setConnected] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [detectionLog, setDetectionLog] = useState([])
  const [stats, setStats] = useState({ pass: 0, fail: 0, review: 0 })
  const [error, setError] = useState(null)
  
  const eventSourceRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(() => {
    if (!lineId) return

    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(`/api/live/${lineId}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'connected') {
          console.log('Connected to live feed:', data.clientId)
          return
        }
        
        if (data.type === 'detection') {
          // Update current frame
          setCurrentFrame(data)
          
          // Add to log (keep limited size)
          setDetectionLog(prev => {
            const newLog = [data, ...prev].slice(0, maxLogSize)
            return newLog
          })
          
          // Update stats
          if (data.result) {
            setStats(prev => ({
              ...prev,
              [data.result]: prev[data.result] + 1
            }))
          }
          
          // Callback
          onDetection?.(data)
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      setConnected(false)
      setError(new Error('Connection lost'))
      
      eventSource.close()
      
      // Auto reconnect
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          connect()
        }, reconnectDelay)
      }
    }
  }, [lineId, maxLogSize, onDetection, autoReconnect, reconnectDelay])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    setConnected(false)
  }, [])

  const clearLog = useCallback(() => {
    setDetectionLog([])
  }, [])

  const resetStats = useCallback(() => {
    setStats({ pass: 0, fail: 0, review: 0 })
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    connected,
    currentFrame,
    detectionLog,
    stats,
    error,
    connect,
    disconnect,
    clearLog,
    resetStats
  }
}
```

---

## Task 3: Create Live View Components

### 3.1 `components/inspection/LiveView.jsx`

```javascript
'use client'

import { useState, useCallback } from 'react'
import { useLiveInspection } from '@/hooks/useLiveInspection'
import { DetectionOverlay } from './DetectionOverlay'
import { DetectionLog } from './DetectionLog'
import { OverrideModal } from '@/components/override/OverrideModal'

export function LiveView({ lineId, lineName, sectionId, user }) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75)
  const [overrideTarget, setOverrideTarget] = useState(null)
  
  const {
    connected,
    currentFrame,
    detectionLog,
    stats,
    error,
    clearLog,
    resetStats
  } = useLiveInspection(lineId, {
    onDetection: (data) => {
      // Could play sound for defects, etc.
      if (data.result === 'fail') {
        // Optional: play alert sound
      }
    }
  })

  const handleOverrideClick = useCallback((frame) => {
    setOverrideTarget({
      boardId: frame.board_id,
      imageUrl: frame.image_url,
      aiDetections: frame.detections
    })
  }, [])

  const filteredDetections = currentFrame?.detections?.filter(
    d => d.confidence >= confidenceThreshold
  ) || []

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Live Inspection</h1>
          <span className="text-gray-500">{lineName || lineId}</span>
          
          {/* Connection Status */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
            <div className="text-xs text-gray-500">Pass</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
            <div className="text-xs text-gray-500">Fail</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.review}</div>
            <div className="text-xs text-gray-500">Review</div>
          </div>
          <button
            onClick={resetStats}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Camera Feed + Overlay */}
        <div className="flex-1 p-4 bg-gray-900 flex flex-col">
          <div className="flex-1 relative flex items-center justify-center">
            {currentFrame?.image_url ? (
              <DetectionOverlay
                imageUrl={currentFrame.image_url}
                detections={filteredDetections}
                result={currentFrame.result}
                onOverrideClick={() => handleOverrideClick(currentFrame)}
              />
            ) : (
              <div className="text-gray-500 text-center">
                <div className="text-4xl mb-2">📷</div>
                <div>Waiting for camera feed...</div>
                {error && <div className="text-red-400 mt-2">{error.message}</div>}
              </div>
            )}
          </div>
          
          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-4 text-white text-sm">
            <div className="flex items-center gap-4">
              <span>Board: {currentFrame?.board_id || '-'}</span>
              <span>Inference: {currentFrame?.inference_ms || 0}ms</span>
            </div>
            
            {/* Confidence Threshold Slider */}
            <div className="flex items-center gap-2">
              <span>Confidence:</span>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="w-12">{Math.round(confidenceThreshold * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Detection Log Sidebar */}
        <div className="w-80 border-l bg-white flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold">Detection Log</h3>
            <button
              onClick={clearLog}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DetectionLog 
              items={detectionLog} 
              onItemClick={handleOverrideClick}
            />
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideTarget && (
        <OverrideModal
          isOpen={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          boardId={overrideTarget.boardId}
          imageUrl={overrideTarget.imageUrl}
          aiDetections={overrideTarget.aiDetections}
          sectionId={sectionId}
          lineId={lineId}
          user={user}
        />
      )}
    </div>
  )
}
```

### 3.2 `components/inspection/DetectionOverlay.jsx`

```javascript
'use client'

import { useRef, useEffect, useState } from 'react'

export function DetectionOverlay({ 
  imageUrl, 
  detections = [], 
  result,
  onOverrideClick,
  width = 800,
  height = 600 
}) {
  const canvasRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef(null)

  // Color based on result
  const resultColors = {
    pass: '#22C55E',
    fail: '#EF4444',
    review: '#F59E0B'
  }

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      setImageLoaded(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    if (!canvasRef.current || !imageLoaded) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear and draw image
    ctx.clearRect(0, 0, width, height)
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, width, height)
    }

    // Draw detections
    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox
      const color = det.confidence >= 0.9 ? '#EF4444' 
                  : det.confidence >= 0.75 ? '#F59E0B' 
                  : '#22C55E'

      // Box
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Label background
      const label = `${det.class} ${Math.round(det.confidence * 100)}%`
      ctx.font = 'bold 14px Inter, sans-serif'
      const labelWidth = ctx.measureText(label).width + 8
      ctx.fillStyle = color
      ctx.fillRect(x1, y1 - 22, labelWidth, 20)

      // Label text
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(label, x1 + 4, y1 - 6)
    })

    // Result indicator
    if (result) {
      const resultLabel = result.toUpperCase()
      ctx.font = 'bold 24px Inter, sans-serif'
      const labelWidth = ctx.measureText(resultLabel).width + 20
      
      ctx.fillStyle = resultColors[result] || '#6B7280'
      ctx.fillRect(width - labelWidth - 10, 10, labelWidth, 36)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(resultLabel, width - labelWidth, 36)
    }

  }, [imageLoaded, detections, result, width, height])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg"
      />

      {/* Override Button - appears on fail/review */}
      {(result === 'fail' || result === 'review') && (
        <button
          onClick={onOverrideClick}
          className="absolute bottom-4 right-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium shadow-lg transition-colors"
        >
          🚫 Report False Call
        </button>
      )}

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
          <div className="text-gray-400">Loading...</div>
        </div>
      )}
    </div>
  )
}
```

### 3.3 `components/inspection/DetectionLog.jsx`

```javascript
'use client'

export function DetectionLog({ items = [], onItemClick }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const resultConfig = {
    pass: { icon: '✓', color: 'text-green-600', bg: 'bg-green-50' },
    fail: { icon: '✗', color: 'text-red-600', bg: 'bg-red-50' },
    review: { icon: '?', color: 'text-yellow-600', bg: 'bg-yellow-50' }
  }

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        No detections yet
      </div>
    )
  }

  return (
    <div className="divide-y">
      {items.map((item, idx) => {
        const config = resultConfig[item.result] || resultConfig.review
        const defectCount = item.detections?.length || 0

        return (
          <div
            key={item.frame_id || idx}
            onClick={() => onItemClick?.(item)}
            className={`p-3 hover:bg-gray-50 cursor-pointer ${config.bg}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                {formatTime(item.timestamp)}
              </span>
              <span className={`text-sm font-bold ${config.color}`}>
                {config.icon} {item.result?.toUpperCase()}
              </span>
            </div>
            
            <div className="text-sm font-medium truncate">
              {item.board_id || 'Unknown Board'}
            </div>
            
            {defectCount > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {defectCount} defect{defectCount > 1 ? 's' : ''} detected
                {item.detections?.slice(0, 2).map((d, i) => (
                  <span key={i} className="ml-1">
                    • {d.class} ({Math.round(d.confidence * 100)}%)
                  </span>
                ))}
              </div>
            )}
            
            <div className="text-xs text-gray-400 mt-1">
              {item.inference_ms}ms
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Task 4: Create Live Inspection Page

### 4.1 `app/(dashboard)/inspection/live/[lineId]/page.jsx`

```javascript
'use client'

import { useParams } from 'next/navigation'
import { LiveView } from '@/components/inspection/LiveView'
import { useAuth } from '@/hooks/useAuth' // atau context auth yang dipakai

export default function LiveInspectionPage() {
  const params = useParams()
  const { lineId } = params
  const { user } = useAuth() // adjust sesuai auth system

  // TODO: Get line details and section info
  const lineName = `Line ${lineId}` // Replace with actual data
  const sectionId = null // Replace with actual section

  return (
    <div className="h-screen">
      <LiveView
        lineId={lineId}
        lineName={lineName}
        sectionId={sectionId}
        user={user}
      />
    </div>
  )
}
```

---

## Task 5: Mock Data Generator (untuk Testing)

### 5.1 `scripts/mockLiveData.js` (run with Node.js)

```javascript
// Run: node scripts/mockLiveData.js
// Sends mock detection data to SSE endpoint

const LINE_ID = 'line-001'
const API_URL = `http://localhost:3000/api/live/${LINE_ID}`
const API_KEY = process.env.EDGE_API_KEY || 'dev-key'

const DEFECT_CLASSES = ['solder_bridge', 'scratch', 'missing_component', 'misalignment']
const RESULTS = ['pass', 'pass', 'pass', 'pass', 'fail', 'review'] // 66% pass rate

function randomBbox() {
  const x1 = Math.floor(Math.random() * 600) + 50
  const y1 = Math.floor(Math.random() * 400) + 50
  const w = Math.floor(Math.random() * 100) + 50
  const h = Math.floor(Math.random() * 80) + 40
  return [x1, y1, x1 + w, y1 + h]
}

function generateFrame() {
  const result = RESULTS[Math.floor(Math.random() * RESULTS.length)]
  const detections = []
  
  if (result !== 'pass') {
    const numDefects = Math.floor(Math.random() * 3) + 1
    for (let i = 0; i < numDefects; i++) {
      detections.push({
        class: DEFECT_CLASSES[Math.floor(Math.random() * DEFECT_CLASSES.length)],
        confidence: 0.7 + Math.random() * 0.28,
        bbox: randomBbox(),
        severity: ['critical', 'major', 'minor'][Math.floor(Math.random() * 3)]
      })
    }
  }

  return {
    frame_id: `frame_${Date.now()}`,
    timestamp: new Date().toISOString(),
    board_id: `PCB-${Math.floor(Math.random() * 9000) + 1000}`,
    image_url: `https://placehold.co/800x600/1a1a2e/ffffff?text=PCB+${Date.now() % 1000}`,
    detections,
    inference_ms: Math.floor(Math.random() * 30) + 20,
    result
  }
}

async function sendFrame() {
  const frame = generateFrame()
  
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(frame)
    })
    
    const data = await res.json()
    console.log(`[${frame.result.toUpperCase()}] ${frame.board_id} - ${data.clients} clients`)
  } catch (err) {
    console.error('Failed to send:', err.message)
  }
}

// Send frame every 2 seconds
console.log(`Starting mock data generator for ${LINE_ID}...`)
setInterval(sendFrame, 2000)
```

---

## Task 6: Environment Setup

### 6.1 Add to `.env.local`

```env
# Edge device API key for live data push
EDGE_API_KEY=your-secure-api-key-here
```

---

## Verification Checklist

1. [ ] SSE endpoint connects successfully
2. [ ] Live view shows "LIVE" indicator when connected
3. [ ] Mock data appears on screen
4. [ ] Detection boxes drawn correctly
5. [ ] Detection log updates in real-time
6. [ ] Stats (pass/fail/review) increment correctly
7. [ ] Confidence threshold slider filters detections
8. [ ] "Report False Call" button appears on fail/review
9. [ ] Override modal opens with correct data
10. [ ] Reconnection works after disconnect

---

## Edge Device Integration (Future)

Untuk integrasi dengan actual edge device:

```python
# Edge device Python example
import requests
import json

API_URL = "https://your-domain.com/api/live/line-001"
API_KEY = "your-api-key"

def send_detection(frame_data):
    response = requests.post(
        API_URL,
        json=frame_data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        }
    )
    return response.json()

# After YOLO inference
result = send_detection({
    "frame_id": "f_001",
    "board_id": "PCB-2024-001",
    "image_url": "https://storage.example.com/frames/f_001.jpg",
    "detections": [
        {"class": "solder_bridge", "confidence": 0.92, "bbox": [120, 45, 180, 95]}
    ],
    "inference_ms": 32,
    "result": "fail"
})
```

---

## Notes

- SSE dipilih karena lebih simple dari WebSocket untuk one-way data
- Edge device push data via POST, client receive via GET (SSE)
- Mock data generator untuk testing tanpa hardware
- Override modal reuse dari Phase 3
- Consider rate limiting untuk production

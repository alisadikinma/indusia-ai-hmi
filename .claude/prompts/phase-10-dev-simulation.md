# Phase 10: Dev/Simulation Endpoints

## Objective
Create simulation endpoints untuk development & testing tanpa AI Backend. Endpoints ini mensimulasikan output AI Backend sesuai API Contract.

---

## Context

Selama development, UI perlu test dengan data simulasi sebelum AI Backend ready. Endpoints ini:
1. **SSE Simulation** - Stream events seperti inspection, hardware_status, running_status
2. **REST Simulation** - Get stages, post confirm
3. **Dev Page** - Testing UI di `/dev/simulation`

---

## API Contract

### SSE Events:
1. `inspection` - AI detection results (decision: PASS/FAIL)
2. `hardware_status` - Camera/PLC status
3. `running_status` - Conveyor stage progress

### REST Endpoints:
4. `GET /stages` - All stage definitions
5. `POST /confirm` - Operator confirmation (operator_decision: GOOD/NG)

### Terminology Alignment

| Layer | Term | Values |
|-------|------|--------|
| AI Backend | `decision` | `PASS` / `FAIL` |
| Operator | `operator_decision` | `GOOD` / `NG` |

**False Call Auto-Detection:**
```javascript
const isFalseCall = 
  (aiDecision === 'PASS' && operatorDecision === 'NG') ||
  (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
```

---

## Task 1: Create SSE Simulation Endpoint

### 1.1 `app/api/dev/sse/[lineId]/route.js`

```javascript
/**
 * Development SSE Simulation
 * Streams simulated inspection events for testing
 *
 * Usage: EventSource('/api/dev/sse/line-1')
 */

import { NextResponse } from 'next/server'

// Sample PCB images (use existing public images)
const SAMPLE_IMAGES = {
  top: [
    '/images/pcb_golden_TOP.png',
    '/images/pcb_IS_01_TOP.png',
    '/images/pcb_MC_01_TOP.png',
    '/images/pcb_SB_01_TOP.png',
    '/images/pcb_TS_01_TOP.png',
  ],
  bottom: [
    '/images/pcb_golden_BOTTOM.png',
    '/images/pcb_CS_01_BOTTOM.png',
    '/images/pcb_SL_01_BOTTOM.png',
  ]
}

// Defect types for simulation
const DEFECT_TYPES = [
  { name: 'solder_bridge', label: 1 },
  { name: 'missing_component', label: 2 },
  { name: 'cold_solder', label: 3 },
  { name: 'tombstone', label: 4 },
  { name: 'insufficient_solder', label: 5 },
]

// Generate random inspection event
function generateInspectionEvent(lineId) {
  const inspectionId = `insp-${Date.now().toString(36)}`
  const isPass = Math.random() > 0.3 // 70% pass rate

  const topImage = SAMPLE_IMAGES.top[Math.floor(Math.random() * SAMPLE_IMAGES.top.length)]

  // Generate random defects if FAIL
  const objects = []
  if (!isPass) {
    const defectCount = Math.floor(Math.random() * 3) + 1
    for (let i = 0; i < defectCount; i++) {
      const defect = DEFECT_TYPES[Math.floor(Math.random() * DEFECT_TYPES.length)]
      objects.push({
        name: defect.name,
        box: [
          Math.floor(Math.random() * 2000) + 500,
          Math.floor(Math.random() * 1500) + 300,
          Math.floor(Math.random() * 200) + 100,
          Math.floor(Math.random() * 200) + 100,
        ],
        label: defect.label,
        score: Math.random() * 0.3 + 0.7, // 0.7 - 1.0
        crop_url: `/images/crops/${defect.name}_${i}.png`
      })
    }
  }

  return {
    inspection_id: inspectionId,
    model_id: '44613b0a-ea4c-4cdb-889f-fbb337059c0e',
    model_name: 'pcb_defect_v1',
    results: {
      top: {
        image_url: `http://localhost:3000${topImage}`,
        objects: objects
      },
      bottom: {
        image_url: '',
        objects: []
      }
    },
    decision: isPass ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString()
  }
}

// Generate hardware status event
function generateHardwareStatusEvent() {
  return {
    status_id: `status-${Date.now()}`,
    timestamp: new Date().toISOString(),
    hardware: {
      cameras: [
        {
          id: 'cam-01',
          name: 'Top Camera',
          status: Math.random() > 0.1 ? 'ONLINE' : 'OFFLINE',
          message: null
        },
        {
          id: 'cam-02',
          name: 'Bottom Camera',
          status: Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE',
          message: Math.random() > 0.8 ? 'Connection timeout' : null
        }
      ],
      plcs: [
        {
          id: 'plc-01',
          name: 'Conveyor PLC',
          status: 'ONLINE',
          message: null
        }
      ]
    }
  }
}

// Stage definitions
const STAGES = [
  { stage_id: 'stage-01', name: 'unit_coming' },
  { stage_id: 'stage-02', name: 'camera_position_1' },
  { stage_id: 'stage-03', name: 'camera_position_2' },
  { stage_id: 'stage-04', name: 'pcb_flipping' },
  { stage_id: 'stage-05', name: 'camera_position_1' },
  { stage_id: 'stage-06', name: 'camera_position_2' },
  { stage_id: 'stage-07', name: 'done' },
]

// Generate running status event
function generateRunningStatusEvent(currentStageIndex) {
  const stage = STAGES[currentStageIndex % STAGES.length]
  return {
    status_id: `run-${Date.now()}`,
    timestamp: new Date().toISOString(),
    stage_id: stage.stage_id,
    stage_name: stage.name,
    completed: false,
    stage_timestamp: null
  }
}

export async function GET(request, { params }) {
  const { lineId } = params
  const { searchParams } = new URL(request.url)

  // Simulation config
  const inspectionInterval = parseInt(searchParams.get('interval') || '5000') // ms between inspections
  const includeHardware = searchParams.get('hardware') !== 'false'
  const includeRunning = searchParams.get('running') !== 'false'

  const encoder = new TextEncoder()
  let stageIndex = 0
  let intervalId = null
  let hardwareIntervalId = null
  let runningIntervalId = null

  const stream = new ReadableStream({
    start(controller) {
      // Send connected event
      controller.enqueue(encoder.encode(
        `event: connected\ndata: ${JSON.stringify({ clientId: `sim-${Date.now()}`, lineId })}\n\n`
      ))

      // Send inspection events
      intervalId = setInterval(() => {
        const event = generateInspectionEvent(lineId)
        controller.enqueue(encoder.encode(
          `event: inspection\ndata: ${JSON.stringify(event)}\n\n`
        ))
      }, inspectionInterval)

      // Send hardware status every 10s
      if (includeHardware) {
        hardwareIntervalId = setInterval(() => {
          const event = generateHardwareStatusEvent()
          controller.enqueue(encoder.encode(
            `event: hardware_status\ndata: ${JSON.stringify(event)}\n\n`
          ))
        }, 10000)
      }

      // Send running status every 2s
      if (includeRunning) {
        runningIntervalId = setInterval(() => {
          const event = generateRunningStatusEvent(stageIndex++)
          controller.enqueue(encoder.encode(
            `event: running_status\ndata: ${JSON.stringify(event)}\n\n`
          ))
        }, 2000)
      }

      // Heartbeat every 30s
      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(
          `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
        ))
      }, 30000)
    },
    cancel() {
      if (intervalId) clearInterval(intervalId)
      if (hardwareIntervalId) clearInterval(hardwareIntervalId)
      if (runningIntervalId) clearInterval(runningIntervalId)
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
```

---

## Task 2: Create Stages API

### 2.1 `app/api/dev/stages/route.js`

```javascript
/**
 * GET /api/dev/stages
 * Returns all conveyor stage definitions
 */

import { NextResponse } from 'next/server'

const STAGES = [
  { stage_id: 'stage-01', name: 'unit_coming', description: 'PCB entering conveyor' },
  { stage_id: 'stage-02', name: 'camera_position_1', description: 'Top camera capture 1' },
  { stage_id: 'stage-03', name: 'camera_position_2', description: 'Top camera capture 2' },
  { stage_id: 'stage-04', name: 'pcb_flipping', description: 'Flip PCB for bottom side' },
  { stage_id: 'stage-05', name: 'camera_position_1', description: 'Bottom camera capture 1' },
  { stage_id: 'stage-06', name: 'camera_position_2', description: 'Bottom camera capture 2' },
  { stage_id: 'stage-07', name: 'done', description: 'Inspection complete' },
]

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const withProgress = searchParams.get('progress') === 'true'

  // Optional: simulate current progress
  if (withProgress) {
    const currentStage = Math.floor(Math.random() * STAGES.length)
    const stagesWithProgress = STAGES.map((stage, index) => ({
      ...stage,
      completed: index < currentStage,
      timestamp: index < currentStage
        ? new Date(Date.now() - (STAGES.length - index) * 5000).toISOString()
        : null
    }))

    return NextResponse.json({
      status_id: `stages-${Date.now()}`,
      timestamp: new Date().toISOString(),
      stages: stagesWithProgress
    })
  }

  return NextResponse.json({
    status_id: `stages-${Date.now()}`,
    timestamp: new Date().toISOString(),
    stages: STAGES.map(s => ({
      ...s,
      completed: false,
      timestamp: null
    }))
  })
}
```

---

## Task 3: Create Confirm API

### 3.1 `app/api/dev/confirm/route.js`

```javascript
/**
 * POST /api/dev/confirm
 * Simulates operator confirmation to AI Backend
 *
 * In production, this would forward to AI Backend for PLC control
 * In dev mode, just returns success
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

const confirmSchema = z.object({
  inspection_id: z.string(),
  unit_id: z.string().optional(),
  ai_decision: z.enum(['PASS', 'FAIL']),
  operator_decision: z.enum(['GOOD', 'NG']),
  false_call_reason_id: z.string().uuid().optional(),
  comment: z.string().optional()
})

export async function POST(request) {
  try {
    const body = await request.json()

    // Validate
    const validation = confirmSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        status: 'ERROR',
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 })
    }

    const { inspection_id, ai_decision, operator_decision, comment } = validation.data

    // Auto-calculate false call
    const isFalseCall = 
      (ai_decision === 'PASS' && operator_decision === 'NG') ||
      (ai_decision === 'FAIL' && operator_decision === 'GOOD')

    // In dev mode, simulate delay and return success
    await new Promise(resolve => setTimeout(resolve, 100))

    // Simulate occasional failure for testing
    if (Math.random() < 0.05) { // 5% failure rate
      return NextResponse.json({
        status: 'ERROR',
        inspection_id,
        error: 'Simulated PLC communication error'
      }, { status: 500 })
    }

    return NextResponse.json({
      status: 'OK',
      inspection_id,
      confirmed_at: new Date().toISOString(),
      ai_decision,
      operator_decision,
      is_false_call: isFalseCall
    })
  } catch (error) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message
    }, { status: 500 })
  }
}
```

---

## Task 4: Create Single Inspection Generator

### 4.1 `app/api/dev/inspection/route.js`

```javascript
/**
 * GET /api/dev/inspection
 * Returns a single simulated inspection event (for testing)
 *
 * Query params:
 * - decision: 'PASS' | 'FAIL' | 'random' (default: random)
 * - defects: number of defects if FAIL (default: random 1-3)
 */

import { NextResponse } from 'next/server'

const DEFECT_TYPES = [
  { name: 'solder_bridge', label: 1, color: '#EF4444' },
  { name: 'missing_component', label: 2, color: '#F59E0B' },
  { name: 'cold_solder', label: 3, color: '#3B82F6' },
  { name: 'tombstone', label: 4, color: '#8B5CF6' },
  { name: 'insufficient_solder', label: 5, color: '#EC4899' },
  { name: 'solder_ball', label: 6, color: '#10B981' },
]

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  const decisionParam = searchParams.get('decision') || 'random'
  const defectCount = parseInt(searchParams.get('defects') || '0')

  let decision = decisionParam
  if (decisionParam === 'random') {
    decision = Math.random() > 0.3 ? 'PASS' : 'FAIL'
  }

  const inspectionId = `insp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  // Generate defects
  const objects = []
  if (decision === 'FAIL') {
    const count = defectCount || Math.floor(Math.random() * 3) + 1
    for (let i = 0; i < count; i++) {
      const defect = DEFECT_TYPES[Math.floor(Math.random() * DEFECT_TYPES.length)]
      const x = Math.floor(Math.random() * 3000) + 500
      const y = Math.floor(Math.random() * 2000) + 300
      const w = Math.floor(Math.random() * 150) + 50
      const h = Math.floor(Math.random() * 150) + 50

      objects.push({
        name: defect.name,
        box: [x, y, x + w, y + h],
        label: defect.label,
        score: Math.random() * 0.25 + 0.75, // 0.75 - 1.0
        crop_url: `/api/dev/crop?defect=${defect.name}&index=${i}`,
        color: defect.color
      })
    }
  }

  const event = {
    inspection_id: inspectionId,
    model_id: '44613b0a-ea4c-4cdb-889f-fbb337059c0e',
    model_name: 'pcb_defect_v1',
    results: {
      top: {
        image_url: decision === 'PASS'
          ? '/images/pcb_golden_TOP.png'
          : `/images/pcb_${objects[0]?.name?.toUpperCase() || 'MC'}_01_TOP.png`,
        objects: objects
      },
      bottom: {
        image_url: '',
        objects: []
      }
    },
    decision: decision,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(event)
}
```

---

## Task 5: Create Hardware Status Generator

### 5.1 `app/api/dev/hardware-status/route.js`

```javascript
/**
 * GET /api/dev/hardware-status
 * Returns current simulated hardware status
 */

import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  // Allow forcing specific states for testing
  const cameraStatus = searchParams.get('camera') || 'ONLINE'
  const plcStatus = searchParams.get('plc') || 'ONLINE'

  const event = {
    status_id: `status-${Date.now()}`,
    timestamp: new Date().toISOString(),
    hardware: {
      cameras: [
        {
          id: 'cam-01',
          name: 'Top Camera',
          status: cameraStatus === 'random'
            ? (Math.random() > 0.1 ? 'ONLINE' : 'OFFLINE')
            : cameraStatus,
          message: null
        },
        {
          id: 'cam-02',
          name: 'Bottom Camera',
          status: cameraStatus === 'random'
            ? (Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE')
            : cameraStatus,
          message: cameraStatus === 'OFFLINE' ? 'Connection timeout' : null
        }
      ],
      plcs: [
        {
          id: 'plc-01',
          name: 'Conveyor PLC',
          status: plcStatus,
          message: plcStatus === 'OFFLINE' ? 'Communication error' : null
        }
      ]
    }
  }

  return NextResponse.json(event)
}
```

---

## Task 6: Create Dev Testing Page

### 6.1 `app/dev/simulation/page.js`

```javascript
/**
 * Development Simulation Testing Page
 * Test SSE events and API responses
 */

'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/button'

export default function SimulationPage() {
  const [sseConnected, setSseConnected] = useState(false)
  const [events, setEvents] = useState([])
  const [lastInspection, setLastInspection] = useState(null)
  const [hardwareStatus, setHardwareStatus] = useState(null)
  const [runningStatus, setRunningStatus] = useState(null)

  // SSE Connection
  const connectSSE = () => {
    const eventSource = new EventSource('/api/dev/sse/line-1?interval=3000')

    eventSource.addEventListener('connected', (e) => {
      setSseConnected(true)
      addEvent('connected', JSON.parse(e.data))
    })

    eventSource.addEventListener('inspection', (e) => {
      const data = JSON.parse(e.data)
      setLastInspection(data)
      addEvent('inspection', data)
    })

    eventSource.addEventListener('hardware_status', (e) => {
      const data = JSON.parse(e.data)
      setHardwareStatus(data)
      addEvent('hardware_status', data)
    })

    eventSource.addEventListener('running_status', (e) => {
      const data = JSON.parse(e.data)
      setRunningStatus(data)
      addEvent('running_status', data)
    })

    eventSource.onerror = () => {
      setSseConnected(false)
      eventSource.close()
    }

    return () => eventSource.close()
  }

  const addEvent = (type, data) => {
    setEvents(prev => [{
      type,
      data,
      timestamp: new Date().toISOString()
    }, ...prev.slice(0, 19)])
  }

  // Test single inspection
  const testInspection = async (decision) => {
    const res = await fetch(`/api/dev/inspection?decision=${decision}`)
    const data = await res.json()
    setLastInspection(data)
    addEvent('inspection (manual)', data)
  }

  // Test confirm with GOOD/NG
  const testConfirm = async (operatorDecision) => {
    if (!lastInspection) return

    const res = await fetch('/api/dev/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inspection_id: lastInspection.inspection_id,
        ai_decision: lastInspection.decision,
        operator_decision: operatorDecision,
        comment: 'Test confirmation'
      })
    })
    const data = await res.json()
    addEvent('confirm', data)
  }

  return (
    <div className="p-6 bg-indusia-bg min-h-screen text-indusia-text">
      <h1 className="text-2xl font-bold mb-6">Simulation Testing</h1>

      {/* SSE Control */}
      <div className="bg-indusia-surface p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">SSE Connection</h2>
        <div className="flex items-center gap-4">
          <Button onClick={connectSSE} disabled={sseConnected}>
            {sseConnected ? 'Connected' : 'Connect SSE'}
          </Button>
          <span className={`px-2 py-1 rounded ${sseConnected ? 'bg-green-500' : 'bg-red-500'}`}>
            {sseConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Manual Tests */}
      <div className="bg-indusia-surface p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">Manual Tests</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => testInspection('PASS')}>Generate PASS</Button>
          <Button onClick={() => testInspection('FAIL')}>Generate FAIL</Button>
          <Button 
            onClick={() => testConfirm('GOOD')} 
            disabled={!lastInspection}
            className="bg-green-600 hover:bg-green-700"
          >
            Confirm GOOD
          </Button>
          <Button 
            onClick={() => testConfirm('NG')} 
            disabled={!lastInspection}
            className="bg-red-600 hover:bg-red-700"
          >
            Confirm NG
          </Button>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Last Inspection */}
        <div className="bg-indusia-surface p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Last Inspection</h3>
          {lastInspection && (
            <div className="text-sm">
              <p>ID: {lastInspection.inspection_id}</p>
              <p className={lastInspection.decision === 'PASS' ? 'text-green-400' : 'text-red-400'}>
                AI Decision: {lastInspection.decision}
              </p>
              <p>Defects: {lastInspection.results.top.objects.length}</p>
            </div>
          )}
        </div>

        {/* Hardware Status */}
        <div className="bg-indusia-surface p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Hardware Status</h3>
          {hardwareStatus && (
            <div className="text-sm">
              {hardwareStatus.hardware.cameras.map(cam => (
                <p key={cam.id} className={cam.status === 'ONLINE' ? 'text-green-400' : 'text-red-400'}>
                  {cam.name}: {cam.status}
                </p>
              ))}
              {hardwareStatus.hardware.plcs.map(plc => (
                <p key={plc.id} className={plc.status === 'ONLINE' ? 'text-green-400' : 'text-red-400'}>
                  {plc.name}: {plc.status}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Running Status */}
        <div className="bg-indusia-surface p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Running Status</h3>
          {runningStatus && (
            <div className="text-sm">
              <p>Stage: {runningStatus.stage_name}</p>
              <p>ID: {runningStatus.stage_id}</p>
              <p>Completed: {runningStatus.completed ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-indusia-surface p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Event Log (Last 20)</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((event, i) => (
            <div key={i} className="text-xs bg-indusia-bg p-2 rounded font-mono">
              <span className="text-indusia-primary">[{event.type}]</span>
              <span className="text-indusia-textMuted ml-2">{event.timestamp}</span>
              <pre className="mt-1 text-indusia-text overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Verification Checklist

### SSE Simulation
- [ ] `GET /api/dev/sse/[lineId]` - Streams inspection, hardware, running events
- [ ] Query params: `interval`, `hardware`, `running`
- [ ] Events match API Contract format exactly

### REST Simulation
- [ ] `GET /api/dev/inspection` - Single inspection generator
- [ ] `GET /api/dev/hardware-status` - Hardware status
- [ ] `GET /api/dev/stages` - Stage definitions
- [ ] `POST /api/dev/confirm` - Operator confirmation with GOOD/NG

### Dev Page
- [ ] `/dev/simulation` - Testing UI works
- [ ] SSE connection toggles
- [ ] GOOD/NG buttons work correctly
- [ ] False call auto-calculated in response

---

## Usage Examples

### Connect to SSE Simulation

```javascript
// In component
const eventSource = new EventSource('/api/dev/sse/line-1?interval=5000')

eventSource.addEventListener('inspection', (e) => {
  const data = JSON.parse(e.data)
  console.log('AI Decision:', data.decision) // PASS or FAIL
})
```

### Get Single Inspection

```bash
# Random decision
curl http://localhost:3000/api/dev/inspection

# Force FAIL with 3 defects
curl "http://localhost:3000/api/dev/inspection?decision=FAIL&defects=3"
```

### Confirm Inspection (GOOD/NG)

```bash
# Operator confirms GOOD (if AI was FAIL, this is a false call)
curl -X POST http://localhost:3000/api/dev/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_id": "insp-abc123",
    "ai_decision": "FAIL",
    "operator_decision": "GOOD"
  }'

# Response includes is_false_call: true
```

### Decision Matrix

| AI Decision | Operator | Result | is_false_call |
|-------------|----------|--------|---------------|
| PASS | GOOD | Pass | false |
| PASS | NG | Reject | **true** |
| FAIL | GOOD | Pass | **true** |
| FAIL | NG | Reject | false |

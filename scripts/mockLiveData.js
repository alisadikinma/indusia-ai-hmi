/**
 * Mock Live Data Generator
 * Simulates edge device sending detection data to SSE endpoint
 *
 * Usage: node scripts/mockLiveData.js
 * Options:
 *   LINE_ID=line-001 - Line ID to send data to
 *   API_URL=http://localhost:3000 - Base URL
 *   INTERVAL=2000 - Interval between frames in ms
 *   EDGE_API_KEY=dev-key - API key for authentication
 */

const LINE_ID = process.env.LINE_ID || 'line-001'
const API_URL = process.env.API_URL || 'http://localhost:3000'
const INTERVAL = parseInt(process.env.INTERVAL || '2000')
const API_KEY = process.env.EDGE_API_KEY || 'dev-key'

const DEFECT_CLASSES = [
  'solder_bridge',
  'scratch',
  'missing_component',
  'misalignment',
  'contamination',
  'cold_solder',
  'lifted_lead',
  'tombstone'
]

const SEVERITIES = ['critical', 'major', 'minor', 'cosmetic']

// Weighted results - ~70% pass rate
const RESULTS = [
  'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass',
  'fail', 'fail',
  'review'
]

function randomBbox(maxWidth = 800, maxHeight = 600) {
  const x1 = Math.floor(Math.random() * (maxWidth - 150)) + 50
  const y1 = Math.floor(Math.random() * (maxHeight - 100)) + 50
  const w = Math.floor(Math.random() * 100) + 50
  const h = Math.floor(Math.random() * 80) + 40
  return [x1, y1, x1 + w, y1 + h]
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateFrame() {
  const result = randomElement(RESULTS)
  const detections = []

  // Only generate defects for fail/review results
  if (result !== 'pass') {
    const numDefects = Math.floor(Math.random() * 3) + 1
    for (let i = 0; i < numDefects; i++) {
      detections.push({
        class: randomElement(DEFECT_CLASSES),
        confidence: 0.7 + Math.random() * 0.28,
        bbox: randomBbox(),
        severity: randomElement(SEVERITIES)
      })
    }
  }

  const frameId = `frame_${Date.now()}`
  const boardId = `PCB-${Math.floor(Math.random() * 9000) + 1000}`

  return {
    frame_id: frameId,
    timestamp: new Date().toISOString(),
    board_id: boardId,
    // Use placeholder image service for demo
    image_url: `https://placehold.co/800x600/1a2942/8a95a8?text=${encodeURIComponent(boardId)}`,
    detections,
    inference_ms: Math.floor(Math.random() * 30) + 20,
    result
  }
}

async function sendFrame() {
  const frame = generateFrame()
  const url = `${API_URL}/api/live/${LINE_ID}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(frame)
    })

    const data = await res.json()

    const resultIcon = {
      pass: '✓',
      fail: '✗',
      review: '?'
    }[frame.result] || '•'

    const defectInfo = frame.detections.length > 0
      ? ` [${frame.detections.map(d => d.class).join(', ')}]`
      : ''

    console.log(
      `[${new Date().toLocaleTimeString()}] ${resultIcon} ${frame.result.toUpperCase().padEnd(6)} ` +
      `${frame.board_id} - ${frame.inference_ms}ms - ${data.clients || 0} client(s)${defectInfo}`
    )
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`)
  }
}

// Main
console.log('='.repeat(60))
console.log('Mock Live Data Generator')
console.log('='.repeat(60))
console.log(`Line ID:  ${LINE_ID}`)
console.log(`API URL:  ${API_URL}/api/live/${LINE_ID}`)
console.log(`Interval: ${INTERVAL}ms`)
console.log('='.repeat(60))
console.log('Press Ctrl+C to stop\n')

// Send first frame immediately
sendFrame()

// Then send at interval
setInterval(sendFrame, INTERVAL)

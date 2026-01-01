/**
 * Live Inspection SSE Endpoint
 * Server-Sent Events for real-time inspection data streaming
 *
 * GET: Client connects to receive live detection data
 * POST: Edge device pushes detection results
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory store for connected clients per line
const clients = new Map()

/**
 * GET /api/live/[lineId]
 * SSE endpoint for clients to receive live detection data
 */
export async function GET(request, { params }) {
  const { lineId } = params

  // Setup SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      if (!clients.has(lineId)) {
        clients.set(lineId, new Set())
      }

      const clientId = Date.now().toString()
      const send = (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (err) {
          console.error('[SSE] Failed to send:', err)
        }
      }

      const client = { id: clientId, send }
      clients.get(lineId).add(client)

      // Send initial connection message
      send({ type: 'connected', lineId, clientId, timestamp: new Date().toISOString() })

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        send({ type: 'heartbeat', timestamp: new Date().toISOString() })
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        const lineClients = clients.get(lineId)
        if (lineClients) {
          lineClients.delete(client)
          if (lineClients.size === 0) {
            clients.delete(lineId)
          }
        }
        console.log(`[SSE] Client ${clientId} disconnected from line ${lineId}`)
      })

      console.log(`[SSE] Client ${clientId} connected to line ${lineId}`)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  })
}

/**
 * POST /api/live/[lineId]
 * Edge device pushes detection results
 * Requires x-api-key header for authentication
 */
export async function POST(request, { params }) {
  const { lineId } = params

  try {
    const body = await request.json()

    // Validate API key (edge device authentication)
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.EDGE_API_KEY || 'dev-key'

    if (apiKey !== expectedKey) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Broadcast to all connected clients for this line
    const lineClients = clients.get(lineId)
    let clientCount = 0

    if (lineClients && lineClients.size > 0) {
      const data = {
        type: 'detection',
        frame_id: body.frame_id || `frame_${Date.now()}`,
        timestamp: body.timestamp || new Date().toISOString(),
        board_id: body.board_id,
        image_url: body.image_url,
        detections: body.detections || [],
        inference_ms: body.inference_ms || 0,
        result: body.result || 'pass' // 'pass', 'fail', 'review'
      }

      lineClients.forEach(client => {
        try {
          client.send(data)
          clientCount++
        } catch (err) {
          console.error('[SSE] Failed to send to client:', err)
        }
      })
    }

    // TODO: Optionally log to database (inspection_frames)
    // await inspectionFramesRepo.log(lineId, body)

    return Response.json({
      success: true,
      clients: clientCount,
      lineId
    })
  } catch (error) {
    console.error('[POST /api/live] Error:', error)
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Helper function to broadcast data to all clients on a line
 * Can be imported and used from other parts of the app
 */
export function broadcastToLine(lineId, data) {
  const lineClients = clients.get(lineId)
  if (lineClients) {
    lineClients.forEach(client => {
      try {
        client.send(data)
      } catch (err) {
        console.error('[SSE] Broadcast failed:', err)
      }
    })
    return lineClients.size
  }
  return 0
}

/**
 * Get connected client count for a line
 */
export function getClientCount(lineId) {
  return clients.get(lineId)?.size || 0
}

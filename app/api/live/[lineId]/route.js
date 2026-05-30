/**
 * Live Inspection SSE Endpoint
 * Server-Sent Events for real-time inspection data streaming
 *
 * GET: Client connects to receive live detection data (requires auth)
 * POST: Edge device pushes detection results (requires API key)
 */

import { getAuthUser } from '@/lib/auth/apiAuth'
import { hasPermission } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory store for connected clients per line
const clients = new Map()

/**
 * GET /api/live/[lineId]
 * SSE endpoint for clients to receive live detection data
 * Requires authentication and inspection:view permission
 */
export async function GET(request, { params }) {
  const { lineId } = params

  // Authenticate user
  const user = await getAuthUser(request)
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check permission
  if (!hasPermission(user.role_id, 'inspection:view')) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

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
          // Silently fail on closed connections
        }
      }

      const client = { id: clientId, send, userId: user.id }
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
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SSE] Client ${clientId} disconnected from line ${lineId}`)
        }
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`[SSE] Client ${clientId} (user: ${user.id}) connected to line ${lineId}`)
      }
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
 * Requires x-api-key header for authentication (NO default key!)
 */
export async function POST(request, { params }) {
  const { lineId } = params

  try {
    // Validate API key (edge device authentication)
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.EDGE_API_KEY

    // SECURITY: No default key - must be explicitly configured
    if (!expectedKey) {
      console.error('[POST /api/live] EDGE_API_KEY not configured!')
      return Response.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      )
    }

    if (!apiKey || apiKey !== expectedKey) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

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
        result: body.result || 'pass'
      }

      lineClients.forEach(client => {
        try {
          client.send(data)
          clientCount++
        } catch (err) {
          // Silently fail on closed connections
        }
      })
    }

    return Response.json({
      success: true,
      clients: clientCount,
      lineId
    })
  } catch (error) {
    console.error('[POST /api/live] Error:', error)
    return Response.json(
      { success: false, error: 'Internal server error' },
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
        // Silently fail
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

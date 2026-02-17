import { withAuth } from '@/lib/auth/apiAuth'
import { getCurrentVersion } from '@/lib/utils/version'
import { createUpdateLog, completeUpdateLog } from '@/lib/repos/updateRepo'
import { runUpdatePipeline } from '@/lib/services/updatePipeline'

/**
 * POST /api/system/update
 *
 * Triggers a system update and streams progress via SSE.
 * Superadmin only. Returns text/event-stream response.
 */
async function handlePOST(request) {
  // Superadmin-only check
  if (request.user.role_id !== 'role_superadmin') {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden — superadmin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body = {}
  try {
    body = await request.json()
  } catch (_) { /* no body is ok */ }

  const fromVersion = getCurrentVersion()
  const toVersion = body.targetVersion || 'latest'
  const skipRestart = body.skipRestart === true
  const userId = request.user.name || request.user.id

  // Create update log entry
  const logResult = await createUpdateLog(fromVersion, toVersion, userId)
  const updateLogId = logResult.success ? logResult.data?.id : null

  // Build SSE stream
  const logBuffer = []
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (step, status, message) => {
        const event = { step, status, message, timestamp: new Date().toISOString() }
        logBuffer.push(`[${event.timestamp}] ${step}: ${message}`)

        const sseData = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(sseData))
        } catch (_) { /* stream may be closed */ }
      }

      try {
        const result = await runUpdatePipeline({
          fromVersion,
          toVersion,
          onProgress: sendEvent,
          userId,
          skipRestart,
        })

        // Update log entry with final status
        if (updateLogId) {
          await completeUpdateLog(updateLogId, {
            status: result.success ? 'success' : 'failed',
            migrationsApplied: result.migrationsApplied,
            commitsPulled: result.commitsPulled,
            errorMessage: result.error,
            logOutput: logBuffer.join('\n'),
          })
        }

        // Send final event
        const finalEvent = {
          step: 'DONE',
          status: result.success ? 'success' : 'failed',
          message: result.success ? 'Update completed successfully!' : `Update failed: ${result.error}`,
          result: {
            success: result.success,
            migrationsApplied: result.migrationsApplied,
            commitsPulled: result.commitsPulled,
            error: result.error,
          },
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`))
      } catch (err) {
        // Unexpected pipeline crash
        if (updateLogId) {
          await completeUpdateLog(updateLogId, {
            status: 'failed',
            errorMessage: err.message,
            logOutput: logBuffer.join('\n'),
          })
        }

        const errorEvent = {
          step: 'ERROR',
          status: 'failed',
          message: `Unexpected error: ${err.message}`,
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export const POST = withAuth()(handlePOST)

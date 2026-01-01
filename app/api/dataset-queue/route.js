import { NextResponse } from 'next/server'
import * as datasetQueueRepo from '@/lib/repos/datasetQueueRepo'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'

/**
 * GET /api/dataset-queue
 * Query params: stats (boolean), limit
 * Returns pending queue items or queue statistics
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const stats = searchParams.get('stats') === 'true'

    if (stats) {
      const result = await datasetQueueRepo.getStats()

      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: result.data
      })
    }

    const limit = parseInt(searchParams.get('limit') || '50')
    const result = await datasetQueueRepo.getPending(limit)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error) {
    console.error('[GET /api/dataset-queue] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dataset-queue
 * Body: { override_id, training_action, priority }
 * Adds a new item to the dataset queue
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body)

    // Basic validation
    const { override_id, training_action, priority } = sanitizedBody
    if (!override_id || !training_action) {
      return NextResponse.json(
        { success: false, error: 'override_id and training_action are required' },
        { status: 400 }
      )
    }

    const result = await datasetQueueRepo.add({ override_id, training_action, priority })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/dataset-queue] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

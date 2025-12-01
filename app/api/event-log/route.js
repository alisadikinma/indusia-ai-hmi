import { NextResponse } from 'next/server'
import * as eventLogRepo from '@/lib/repos/eventLogRepo'

/**
 * GET /api/event-log
 * Query params: type, source, user_id, from, to, page, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      type: searchParams.get('type'),
      source: searchParams.get('source'),
      userId: searchParams.get('user_id'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      page: parseInt(searchParams.get('page')) || 1,
      limit: parseInt(searchParams.get('limit')) || 50
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key]
    })

    const result = await eventLogRepo.list(filters)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/event-log
 * Body: { type, source, userId, userName, details, metadata }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.type || !body.source) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, source' },
        { status: 400 }
      )
    }

    const result = await eventLogRepo.create(body)

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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

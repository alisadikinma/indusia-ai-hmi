import { NextResponse } from 'next/server'
import * as notificationsRepo from '@/lib/repos/notificationsRepo'

/**
 * GET /api/notifications
 * Query params: user_id (required), read, type, severity, page, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      )
    }

    const filters = {
      read: searchParams.get('read') === 'true' ? true : searchParams.get('read') === 'false' ? false : undefined,
      type: searchParams.get('type'),
      severity: searchParams.get('severity'),
      page: parseInt(searchParams.get('page')) || 1,
      limit: parseInt(searchParams.get('limit')) || 50
    }

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null) delete filters[key]
    })

    const result = await notificationsRepo.list(userId, filters)

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
 * POST /api/notifications
 * Body: { userId, type, severity, category, title, message, metadata }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.userId || !body.title || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, title, message' },
        { status: 400 }
      )
    }

    const result = await notificationsRepo.create(body)

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

/**
 * PATCH /api/notifications
 * Body: { ids: [...], read: true } or { userId: '...', markAllRead: true }
 */
export async function PATCH(request) {
  try {
    const body = await request.json()

    // Mark all as read for user
    if (body.userId && body.markAllRead) {
      const result = await notificationsRepo.markAllAsRead(body.userId)
      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, data: { markedAllRead: true } })
    }

    // Mark specific notifications as read
    if (body.ids && Array.isArray(body.ids)) {
      const results = await Promise.all(
        body.ids.map(id => notificationsRepo.markAsRead(id))
      )
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Some notifications failed to update' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, data: { updated: body.ids.length } })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Notifications API
 * 
 * GET /api/notifications - List notifications for user
 * POST /api/notifications - Create notification
 * PATCH /api/notifications - Mark as read
 */

import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001'

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

    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 50
    const offset = (page - 1) * limit

    // Build query string
    let queryParts = [`user_id=eq.${userId}`]
    
    const readParam = searchParams.get('read')
    if (readParam === 'true') queryParts.push('read=eq.true')
    else if (readParam === 'false') queryParts.push('read=eq.false')
    
    const type = searchParams.get('type')
    if (type) queryParts.push(`type=eq.${type}`)
    
    const severity = searchParams.get('severity')
    if (severity) queryParts.push(`severity=eq.${severity}`)

    const queryString = queryParts.join('&')

    // Get total count
    const countRes = await fetch(
      `${POSTGREST_URL}/notifications?${queryString}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'Prefer': 'count=exact'
        } 
      }
    )
    const total = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0')

    // Get paginated data
    const dataRes = await fetch(
      `${POSTGREST_URL}/notifications?${queryString}&order=created_at.desc&limit=${limit}&offset=${offset}`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!dataRes.ok) {
      const errorText = await dataRes.text()
      return NextResponse.json(
        { success: false, error: errorText },
        { status: 500 }
      )
    }

    const data = await dataRes.json()

    // Transform to camelCase
    const transformed = (data || []).map(item => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      category: item.category,
      title: item.title,
      message: item.message,
      severity: item.severity,
      read: item.read,
      metadata: item.metadata,
      createdAt: item.created_at
    }))

    return NextResponse.json({
      success: true,
      data: transformed,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('[API] GET /api/notifications error:', error)
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

    // Handle snake_case or camelCase input
    const userId = body.userId || body.user_id
    const title = body.title
    const message = body.message

    if (!userId || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, title, message' },
        { status: 400 }
      )
    }

    const dbData = {
      user_id: userId,
      type: body.type || 'WORKFLOW',
      category: body.category || 'GENERAL',
      title,
      message,
      severity: body.severity || 'INFO',
      metadata: body.metadata || null,  // JSONB column - pass object directly
      read: false,
      created_at: new Date().toISOString()
    }

    const response = await fetch(`${POSTGREST_URL}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dbData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: errorText },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json(
      { success: true, data: data[0] || data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API] POST /api/notifications error:', error)
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
      const response = await fetch(
        `${POSTGREST_URL}/notifications?user_id=eq.${body.userId}&read=eq.false`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ read: true })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { success: false, error: errorText },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data: { markedAllRead: true } })
    }

    // Mark specific notification as read
    if (body.id) {
      const response = await fetch(
        `${POSTGREST_URL}/notifications?id=eq.${body.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ read: true })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { success: false, error: errorText },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data: { updated: 1 } })
    }

    // Mark multiple as read
    if (body.ids && Array.isArray(body.ids)) {
      const results = await Promise.all(
        body.ids.map(async (id) => {
          const res = await fetch(
            `${POSTGREST_URL}/notifications?id=eq.${id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ read: true })
            }
          )
          return res.ok
        })
      )
      
      const successCount = results.filter(Boolean).length
      return NextResponse.json({ success: true, data: { updated: successCount } })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[API] PATCH /api/notifications error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

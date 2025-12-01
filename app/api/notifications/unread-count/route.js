import { NextResponse } from 'next/server'
import * as notificationsRepo from '@/lib/repos/notificationsRepo'

/**
 * GET /api/notifications/unread-count
 * Query params: user_id (required)
 * Returns: { count: 5 }
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

    const result = await notificationsRepo.getUnreadCount(userId)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { count: result.data }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

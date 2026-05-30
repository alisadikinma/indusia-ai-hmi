import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { getActiveUpdate } from '@/lib/repos/updateRepo'

/**
 * GET /api/system/update/progress
 *
 * Fallback endpoint to check update status if the SSE connection drops.
 * Returns the latest in-progress update log entry.
 */
async function handleGET(request) {
  if (request.user.role_id !== 'role_superadmin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden — superadmin only' },
      { status: 403 }
    )
  }

  const result = await getActiveUpdate()

  return NextResponse.json({
    success: true,
    data: {
      inProgress: result.success && result.data !== null,
      update: result.data,
    },
  })
}

export const GET = withAuth()(handleGET)

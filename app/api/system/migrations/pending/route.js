import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { getPendingMigrations } from '@/lib/repos/updateRepo'

async function handleGET(request) {
  // Superadmin-only check
  if (request.user.role_id !== 'role_superadmin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden — superadmin only' },
      { status: 403 }
    )
  }

  const result = await getPendingMigrations()
  return NextResponse.json(result)
}

export const GET = withAuth()(handleGET)

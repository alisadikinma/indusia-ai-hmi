import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { getSectionFilter } from '@/lib/auth/sectionAccess'

/**
 * GET /api/overrides/stats
 * Returns: { pending: 5, approved: 20, rejected: 3, total: 28 }
 * Section-filtered based on user's access
 */
async function handleGET(request) {
  try {
    const user = request.user
    const allowedSections = getSectionFilter(user)
    
    // Build filters
    const filters = {}
    if (allowedSections !== null) {
      filters.sectionIds = allowedSections
    }

    const result = await overridesRepo.getStats(filters)

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
    console.error('[GET /api/overrides/stats] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const GET = withAuth('overrides:read')(handleGET)

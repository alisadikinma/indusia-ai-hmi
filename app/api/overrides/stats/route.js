import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'

/**
 * GET /api/overrides/stats
 * Returns: { pending: 5, approved: 20, rejected: 3, total: 28 }
 */
export async function GET() {
  try {
    const result = await overridesRepo.getStats()

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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

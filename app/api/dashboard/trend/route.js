import { NextResponse } from 'next/server'
import * as dashboardRepo from '@/lib/repos/dashboardRepo'

/**
 * GET /api/dashboard/trend
 * Query params: section_id, line_id, days
 * Returns daily trend data for charts
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const section_id = searchParams.get('section_id')
    const line_id = searchParams.get('line_id')
    const days = parseInt(searchParams.get('days') || '7')

    const result = await dashboardRepo.getTrend({ section_id, line_id, days })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Group by date and calculate rates
    const grouped = result.data?.reduce((acc, row) => {
      const date = row.shiftDate
      if (!acc[date]) {
        acc[date] = { date, totalInspected: 0, totalDefect: 0, totalPass: 0 }
      }
      acc[date].totalInspected += row.totalInspected || 0
      acc[date].totalDefect += row.totalDefect || 0
      acc[date].totalPass += row.totalPass || 0
      return acc
    }, {})

    const trend = Object.values(grouped || {}).map(day => ({
      ...day,
      defectRate: day.totalInspected > 0
        ? parseFloat(((day.totalDefect / day.totalInspected) * 100).toFixed(2))
        : 0,
      yieldRate: day.totalInspected > 0
        ? parseFloat(((day.totalPass / day.totalInspected) * 100).toFixed(2))
        : 0
    }))

    return NextResponse.json({
      success: true,
      data: trend
    })
  } catch (error) {
    console.error('[GET /api/dashboard/trend] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

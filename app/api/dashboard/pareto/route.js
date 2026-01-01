import { NextResponse } from 'next/server'
import * as dashboardRepo from '@/lib/repos/dashboardRepo'
import * as defectClassesRepo from '@/lib/repos/defectClassesRepo'

/**
 * GET /api/dashboard/pareto
 * Query params: section_id, line_id, days, limit
 * Returns defect pareto data (top N defect types)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const section_id = searchParams.get('section_id')
    const line_id = searchParams.get('line_id')
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '10')

    const result = await dashboardRepo.getPareto({ section_id, line_id, days })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Aggregate defect_breakdown from all records
    const aggregated = {}
    result.data?.forEach(row => {
      if (row.defect_breakdown) {
        Object.entries(row.defect_breakdown).forEach(([code, count]) => {
          aggregated[code] = (aggregated[code] || 0) + count
        })
      }
    })

    // Get defect class names
    const classesResult = await defectClassesRepo.getAll(false)
    const classMap = classesResult.data?.reduce((acc, dc) => {
      acc[dc.code] = dc
      return acc
    }, {}) || {}

    // Sort and limit
    const total = Object.values(aggregated).reduce((a, b) => a + b, 0)
    const pareto = Object.entries(aggregated)
      .map(([code, count]) => ({
        defectCode: code,
        defectName: classMap[code]?.name || code,
        severity: classMap[code]?.severity || 'unknown',
        color: classMap[code]?.color || '#6B7280',
        count,
        percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    // Add cumulative percentage for pareto chart
    let cumulative = 0
    pareto.forEach(item => {
      cumulative += item.percentage
      item.cumulativePercentage = parseFloat(cumulative.toFixed(2))
    })

    return NextResponse.json({
      success: true,
      data: pareto,
      total
    })
  } catch (error) {
    console.error('[GET /api/dashboard/pareto] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

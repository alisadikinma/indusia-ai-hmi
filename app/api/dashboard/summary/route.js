import { NextResponse } from 'next/server'
import * as dashboardRepo from '@/lib/repos/dashboardRepo'

/**
 * GET /api/dashboard/summary
 * Query params: section_id, line_id, date, shift
 * Returns aggregated KPIs for the specified filters
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const section_id = searchParams.get('section_id')
    const line_id = searchParams.get('line_id')
    const shift_date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const shift_number = searchParams.get('shift')

    const result = await dashboardRepo.getSummary({
      section_id,
      line_id,
      shift_date,
      shift_number
    })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Aggregate if multiple records
    const summary = result.data?.reduce((acc, row) => ({
      totalInspected: acc.totalInspected + (row.totalInspected || 0),
      totalPass: acc.totalPass + (row.totalPass || 0),
      totalDefect: acc.totalDefect + (row.totalDefect || 0),
      totalFalseCall: acc.totalFalseCall + (row.totalFalseCall || 0),
      avgConfidence: row.avgConfidence // simplified - takes last value
    }), { totalInspected: 0, totalPass: 0, totalDefect: 0, totalFalseCall: 0, avgConfidence: 0 })

    // Calculate rates
    const defectRate = summary.totalInspected > 0
      ? parseFloat(((summary.totalDefect / summary.totalInspected) * 100).toFixed(2))
      : 0
    const yieldRate = summary.totalInspected > 0
      ? parseFloat(((summary.totalPass / summary.totalInspected) * 100).toFixed(2))
      : 0
    const falseCallRate = summary.totalDefect > 0
      ? parseFloat(((summary.totalFalseCall / summary.totalDefect) * 100).toFixed(2))
      : 0

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        defectRate,
        yieldRate,
        falseCallRate
      }
    })
  } catch (error) {
    console.error('[GET /api/dashboard/summary] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

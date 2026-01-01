import { NextResponse } from 'next/server'
import * as dashboardRepo from '@/lib/repos/dashboardRepo'

/**
 * GET /api/dashboard/heatmap
 * Query params: section_id, line_id, days
 * Returns defect location heatmap data
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const section_id = searchParams.get('section_id')
    const line_id = searchParams.get('line_id')
    const days = parseInt(searchParams.get('days') || '7')

    const result = await dashboardRepo.getHeatmap({ section_id, line_id, days })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Aggregate defect_locations from all records
    const locationMap = {}
    result.data?.forEach(row => {
      if (Array.isArray(row.defect_locations)) {
        row.defect_locations.forEach(loc => {
          const key = `${loc.x}-${loc.y}-${loc.class}`
          if (!locationMap[key]) {
            locationMap[key] = { x: loc.x, y: loc.y, defectClass: loc.class, count: 0 }
          }
          locationMap[key].count += loc.count || 1
        })
      }
    })

    const heatmapData = Object.values(locationMap)

    // Calculate max count for normalization
    const maxCount = Math.max(...heatmapData.map(d => d.count), 1)

    // Add intensity (0-1) for visualization
    heatmapData.forEach(item => {
      item.intensity = parseFloat((item.count / maxCount).toFixed(3))
    })

    return NextResponse.json({
      success: true,
      data: heatmapData,
      maxCount
    })
  } catch (error) {
    console.error('[GET /api/dashboard/heatmap] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

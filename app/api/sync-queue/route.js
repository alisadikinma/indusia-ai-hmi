/**
 * Sync Queue API
 * GET /api/sync-queue - Get pending sync items from all synced tables
 * 
 * Returns pending records from:
 * - inspection_results
 * - inspection_defects  
 * - overrides
 * - inspection_stats
 * - work_orders
 */

import { NextResponse } from 'next/server'
import syncRepo from '@/lib/repos/syncRepo'

// Friendly table names for UI
const TABLE_NAMES = {
  'inspection_results': 'Inspection Results',
  'inspection_defects': 'Inspection Defects',
  'overrides': 'False Call Overrides',
  'inspection_stats': 'Inspection Stats',
  'work_orders': 'Work Orders',
  'event_log': 'Event Log'
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const grouped = searchParams.get('grouped') === 'true'

    // Get pending counts from actual tables
    const pendingCounts = await syncRepo.getPendingCounts()
    
    // Calculate total
    const totalPending = pendingCounts.reduce((sum, c) => sum + c.count, 0)

    if (grouped) {
      // Return as grouped items for table display (only pending > 0)
      const items = pendingCounts
        .filter(p => p.count > 0)
        .map((p, index) => ({
          id: `pending-${p.table}-${index}`,
          boardId: '-',
          customerName: TABLE_NAMES[p.table] || p.table,
          sectionName: '-',
          defectsCount: p.count,
          type: p.table,
          status: 'ready'
        }))

      return NextResponse.json({
        success: true,
        data: items
      })
    }

    // Return ALL tables with counts (including 0)
    return NextResponse.json({
      success: true,
      data: pendingCounts.map(p => ({
        table: p.table,
        displayName: TABLE_NAMES[p.table] || p.table,
        count: p.count
      })),
      count: totalPending
    })

  } catch (error) {
    console.error('[API] GET /api/sync-queue error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

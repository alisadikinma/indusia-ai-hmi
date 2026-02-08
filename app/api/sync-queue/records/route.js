/**
 * Sync Queue Records API
 * GET /api/sync-queue/records?table=<name>&limit=20
 *
 * Returns pending sync records for a specific table with display-friendly summaries.
 * Used by the Sync page's expandable table detail view.
 */

import { NextResponse } from 'next/server'
import syncRepo from '@/lib/repos/syncRepo'
import { ALLOWED_TABLES, formatRecord, tableColumns } from '../_shared/formatters'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing table parameter' },
        { status: 400 }
      )
    }

    const records = await syncRepo.getPendingRecords(table, limit)
    const formatter = formatRecord[table]
    const formatted = records.map(formatter)

    return NextResponse.json({
      success: true,
      data: formatted,
      columns: tableColumns[table],
      table,
      count: formatted.length
    })
  } catch (error) {
    console.error('[API] GET /api/sync-queue/records error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

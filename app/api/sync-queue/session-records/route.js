/**
 * Sync Queue Session Records API
 * GET /api/sync-queue/session-records?start=ISO&end=ISO&table=NAME&status=synced|failed&limit=20
 *
 * Returns records that were synced (or failed) during a specific sync session.
 * - status=synced: queries by synced_at time range (session-specific)
 * - status=failed: queries all currently-failed records (not session-specific)
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { ALLOWED_TABLES, formatRecord, tableColumns } from '@/lib/sync/formatters'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const table = searchParams.get('table')
    const status = searchParams.get('status') || 'synced'
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'Missing start or end timestamp' },
        { status: 400 }
      )
    }

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing table parameter' },
        { status: 400 }
      )
    }

    let query
    let isSessionSpecific = true

    if (status === 'synced') {
      // Records synced during this session (by synced_at range)
      query = supabase
        .from(table)
        .select('*')
        .eq('sync_status', 'synced')
        .gte('synced_at', start)
        .lte('synced_at', end)
        .order('synced_at', { ascending: false })
        .limit(limit)
    } else {
      // All currently-failed records (not session-specific)
      isSessionSpecific = false
      query = supabase
        .from(table)
        .select('*')
        .eq('sync_status', 'failed')
        .order('created_at', { ascending: false })
        .limit(limit)
    }

    const { data, error, count } = await query

    if (error) {
      console.error(`[API] session-records query error for ${table}:`, error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const formatter = formatRecord[table]
    const formatted = (data || []).map(formatter)

    return NextResponse.json({
      success: true,
      data: formatted,
      columns: tableColumns[table],
      table,
      count: formatted.length,
      isSessionSpecific
    })
  } catch (error) {
    console.error('[API] GET /api/sync-queue/session-records error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

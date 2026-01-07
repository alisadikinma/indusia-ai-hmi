/**
 * Sync History API
 * GET /api/sync-queue/history - Get sync history with pagination
 * 
 * Query params:
 *   - limit: number (default 10)
 *   - offset: number (default 0)
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 10
    const offset = parseInt(searchParams.get('offset')) || 0

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('sync_log')
      .select('*', { count: 'exact', head: true })
      .eq('sync_type', 'to_cloud')

    // Get paginated data from sync_log table
    const { data: syncLogData, error: syncLogError } = await supabase
      .from('sync_log')
      .select('*')
      .eq('sync_type', 'to_cloud')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!syncLogError && syncLogData) {
      // Map sync_log format to UI format
      const mappedData = syncLogData.map(item => ({
        id: item.id,
        record_count: item.records_processed,
        success_count: item.records_success,
        failed_count: item.records_failed,
        status: item.status,
        started_at: item.started_at,
        completed_at: item.completed_at,
        duration_ms: item.duration_ms,
        triggered_by: item.triggered_by,
        tables_synced: item.tables_synced,
        table_details: item.table_details,
        error_message: item.error_message
      }))

      return NextResponse.json({ 
        success: true, 
        data: mappedData,
        total: totalCount || mappedData.length,
        limit,
        offset
      })
    }

    // Fallback to sync_history table if sync_log fails
    const { data: historyData, error: historyError, count: historyCount } = await supabase
      .from('sync_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!historyError && historyData) {
      const mappedData = historyData.map(item => ({
        id: item.id,
        record_count: item.record_count,
        success_count: item.success_count,
        failed_count: item.failed_count,
        status: item.status,
        started_at: item.started_at,
        completed_at: item.completed_at,
        duration_ms: item.duration_ms,
        triggered_by: item.triggered_by
      }))

      return NextResponse.json({ 
        success: true, 
        data: mappedData,
        total: historyCount || mappedData.length,
        limit,
        offset
      })
    }

    // No data found
    return NextResponse.json({ success: true, data: [], total: 0, limit, offset })

  } catch (error) {
    console.error('[API] GET /api/sync-queue/history error:', error)
    return NextResponse.json({ success: true, data: [], total: 0 })
  }
}

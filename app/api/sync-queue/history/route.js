/**
 * Sync History API
 * GET /api/sync-queue/history - Get sync history
 * 
 * Tries sync_log first, falls back to sync_history
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 10

    // Try sync_log table first
    const { data: syncLogData, error: syncLogError } = await supabase
      .from('sync_log')
      .select('*')
      .eq('sync_type', 'to_cloud')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (!syncLogError && syncLogData && syncLogData.length > 0) {
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
        table_details: item.table_details, // Per-table breakdown
        error_message: item.error_message
      }))

      return NextResponse.json({ success: true, data: mappedData })
    }

    // Fallback to sync_history table
    const { data: historyData, error: historyError } = await supabase
      .from('sync_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!historyError && historyData && historyData.length > 0) {
      // Map sync_history format to UI format
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

      return NextResponse.json({ success: true, data: mappedData })
    }

    // No data found in either table
    return NextResponse.json({ success: true, data: [] })

  } catch (error) {
    console.error('[API] GET /api/sync-queue/history error:', error)
    // Return empty array on error (graceful degradation)
    return NextResponse.json({ success: true, data: [] })
  }
}

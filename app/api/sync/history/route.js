/**
 * GET /api/sync/history
 *
 * Get recent sync history from sync_log table.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 10

    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('sync_type', 'to_cloud')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('[API] sync_log table does not exist yet')
        return NextResponse.json({
          success: true,
          data: []
        })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('[API] Sync history error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

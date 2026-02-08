/**
 * Sync Queue Cloud Compare API
 * GET /api/sync-queue/compare?start=ISO&end=ISO&table=NAME
 *
 * Compares locally-synced records with cloud Supabase to verify sync integrity.
 * Returns match counts and any missing record IDs.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { supabaseAdmin, isCloudSyncConfigured } from '@/lib/sync/supabaseAdmin'
import { ALLOWED_TABLES } from '../_shared/formatters'

const BATCH_SIZE = 50

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const table = searchParams.get('table')

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

    // Check cloud configuration
    if (!isCloudSyncConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cloud sync not configured', offline: true },
        { status: 503 }
      )
    }

    // Get local synced record IDs for this session
    const { data: localRecords, error: localError } = await supabase
      .from(table)
      .select('id')
      .eq('sync_status', 'synced')
      .gte('synced_at', start)
      .lte('synced_at', end)

    if (localError) {
      console.error(`[Compare] Local query error for ${table}:`, localError)
      return NextResponse.json(
        { success: false, error: localError.message },
        { status: 500 }
      )
    }

    const localIds = (localRecords || []).map(r => r.id)

    if (localIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          localCount: 0,
          cloudCount: 0,
          matchedCount: 0,
          missingInCloud: [],
          allVerified: true
        }
      })
    }

    // Batch-query cloud for the same IDs
    const cloudIds = new Set()
    for (let i = 0; i < localIds.length; i += BATCH_SIZE) {
      const batch = localIds.slice(i, i + BATCH_SIZE)
      const { data: cloudRecords, error: cloudError } = await supabaseAdmin
        .from(table)
        .select('id')
        .in('id', batch)

      if (cloudError) {
        console.error(`[Compare] Cloud query error for ${table} batch ${i}:`, cloudError)
        return NextResponse.json(
          { success: false, error: 'Cloud query failed: ' + cloudError.message, offline: true },
          { status: 503 }
        )
      }

      (cloudRecords || []).forEach(r => cloudIds.add(r.id))
    }

    // Compute diff
    const missingInCloud = localIds.filter(id => !cloudIds.has(id))

    return NextResponse.json({
      success: true,
      data: {
        localCount: localIds.length,
        cloudCount: cloudIds.size,
        matchedCount: localIds.length - missingInCloud.length,
        missingInCloud: missingInCloud.slice(0, 20), // Cap at 20 IDs for response size
        missingTotal: missingInCloud.length,
        allVerified: missingInCloud.length === 0
      }
    })
  } catch (error) {
    console.error('[API] GET /api/sync-queue/compare error:', error)
    return NextResponse.json(
      { success: false, error: error.message, offline: true },
      { status: 503 }
    )
  }
}

/**
 * AI Boards API
 * GET: List PCB board definitions
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const customerId = searchParams.get('customer_id')
    const partNumber = searchParams.get('part_number')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('boards')
      .select(`
        id,
        name,
        part_number,
        customer_id,
        cavity_count,
        top_frame_count,
        bottom_frame_count,
        customer:customers(id, name, code)
      `, { count: 'exact' })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (partNumber) {
      query = query.ilike('part_number', `%${partNumber}%`)
    }

    query = query
      .order('name')
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('GET /api/ai/boards error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Transform to camelCase
    const transformed = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      partNumber: row.part_number,
      customerId: row.customer_id,
      cavityCount: row.cavity_count || 1,
      topFrameCount: row.top_frame_count || 1,
      bottomFrameCount: row.bottom_frame_count || 0,
      customer: row.customer
    }))

    return NextResponse.json({
      success: true,
      data: transformed,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('GET /api/ai/boards error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

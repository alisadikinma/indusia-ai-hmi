/**
 * AI Boards [id] API
 * GET: Get single board by ID
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request, { params }) {
  try {
    const { id } = params

    const { data, error } = await supabase
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
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Board not found' }, { status: 404 })
      }
      console.error('GET /api/ai/boards/[id] error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const transformed = {
      id: data.id,
      name: data.name,
      partNumber: data.part_number,
      customerId: data.customer_id,
      cavityCount: data.cavity_count || 1,
      topFrameCount: data.top_frame_count || 1,
      bottomFrameCount: data.bottom_frame_count || 0,
      customer: data.customer
    }

    return NextResponse.json({ success: true, data: transformed })
  } catch (error) {
    console.error('GET /api/ai/boards/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

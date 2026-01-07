/**
 * AI Lines [id] API
 * GET: Get single line by ID
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request, { params }) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('lines')
      .select(`
        id,
        name,
        section_id,
        customer_id,
        section:sections(id, name),
        customer:customers(id, name, code)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Line not found' }, { status: 404 })
      }
      console.error('GET /api/ai/lines/[id] error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const transformed = {
      id: data.id,
      name: data.name,
      sectionId: data.section_id,
      customerId: data.customer_id,
      section: data.section,
      customer: data.customer
    }

    return NextResponse.json({ success: true, data: transformed })
  } catch (error) {
    console.error('GET /api/ai/lines/[id] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

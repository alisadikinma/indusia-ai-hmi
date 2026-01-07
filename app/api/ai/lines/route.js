/**
 * AI Lines API
 * GET: List production lines with model assignment
 * 
 * Actual lines schema: id, name, customer_id, section_id
 * (ai_model_id, ai_backend_url from migration 027 may not be applied)
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const customerId = searchParams.get('customer_id')
    const sectionId = searchParams.get('section_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Use only base schema columns
    let query = supabase
      .from('lines')
      .select(`
        id,
        name,
        section_id,
        customer_id,
        section:sections(id, name),
        customer:customers(id, name, code)
      `, { count: 'exact' })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (sectionId) {
      query = query.eq('section_id', sectionId)
    }

    query = query
      .order('name')
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('GET /api/ai/lines error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Transform to camelCase
    const transformed = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      sectionId: row.section_id,
      customerId: row.customer_id,
      section: row.section,
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
    console.error('GET /api/ai/lines error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

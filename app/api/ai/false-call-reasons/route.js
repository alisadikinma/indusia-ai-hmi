/**
 * False Call Reasons API (Read-only for AI Backend)
 * GET: List active false call reasons
 * 
 * Schema: id, code, name, description, is_active, sort_order?, created_at
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('id, code, name, description, is_active, created_at')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('GET /api/ai/false-call-reasons error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('GET /api/ai/false-call-reasons error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

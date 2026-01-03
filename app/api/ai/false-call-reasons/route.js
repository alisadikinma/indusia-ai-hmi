/**
 * False Call Reasons API (Read-only for AI Backend)
 * GET: List active false call reasons
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return successResponse(data || [])
  } catch (error) {
    console.error('GET /api/ai/false-call-reasons error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

/**
 * Defect Classes API (Read-only for AI Backend)
 * GET: List active defect classes
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return successResponse(data || [])
  } catch (error) {
    console.error('GET /api/ai/defect-classes error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

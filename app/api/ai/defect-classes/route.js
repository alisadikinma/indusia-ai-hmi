/**
 * Defect Classes API (Read-only for AI Backend)
 * GET: List active defect classes
 * 
 * Ultra-minimal schema: id, code, name, severity, description, is_active, created_at
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('id, code, name, severity, description, is_active, created_at')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('GET /api/ai/defect-classes error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('GET /api/ai/defect-classes error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)

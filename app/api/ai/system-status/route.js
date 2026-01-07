/**
 * System Status API
 * GET: Get current system status
 * POST: Update component status
 * 
 * Schema: id, component, status, message, details, updated_at, created_at
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('system_status')
      .select('*')
      .order('component')

    if (error) {
      console.error('GET /api/ai/system-status error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Format response
    const components = {}
    let lastUpdated = null

    for (const row of (data || [])) {
      components[row.component] = {
        status: row.status,
        message: row.message,
        details: row.details,
        updatedAt: row.updated_at
      }

      if (!lastUpdated || row.updated_at > lastUpdated) {
        lastUpdated = row.updated_at
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        components,
        lastUpdated,
        service: 'indusia-ai-hmi',
        version: '2.0.0',
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('GET /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()

    const { component, status, message, details } = body

    if (!component) {
      return NextResponse.json({ success: false, error: 'component is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('system_status')
      .upsert({
        component,
        status: status || 'unknown',
        message: message || null,
        details: details || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'component' })
      .select()
      .single()

    if (error) {
      console.error('POST /api/ai/system-status error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('POST /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

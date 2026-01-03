/**
 * System Status API
 * GET: Get current system status
 * POST: Update component status
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { successResponse } from '@/lib/utils/apiResponse'
import { supabase } from '@/lib/supabaseClient'

async function handleGET(request) {
  try {
    const { data, error } = await supabase
      .from('system_status')
      .select('*')
      .order('component')

    if (error) throw error

    // Group by component type
    const grouped = {
      ai_model: null,
      cameras: [],
      plcs: [],
      last_updated: null
    }

    for (const row of (data || [])) {
      if (row.component === 'ai_model') {
        grouped.ai_model = {
          status: row.status,
          ...row.metadata
        }
      } else if (row.component === 'camera') {
        grouped.cameras.push({
          id: row.component_id,
          name: row.metadata?.name || row.component_id,
          status: row.status,
          message: row.message
        })
      } else if (row.component === 'plc') {
        grouped.plcs.push({
          id: row.component_id,
          name: row.metadata?.name || row.component_id,
          status: row.status,
          message: row.message
        })
      }

      if (!grouped.last_updated || row.updated_at > grouped.last_updated) {
        grouped.last_updated = row.updated_at
      }
    }

    // Add service info
    grouped.service = 'indusia-ai-hmi'
    grouped.version = process.env.npm_package_version || '1.0.0'
    grouped.timestamp = new Date().toISOString()
    grouped.auth = {
      type: request.authType,
      valid: request.apiKeyAuth
    }

    return successResponse(grouped)
  } catch (error) {
    console.error('GET /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handlePOST(request) {
  try {
    const body = await request.json()

    // Handle batch updates
    const updates = body.updates || [body]

    for (const update of updates) {
      const { component, component_id, status, message, metadata } = update

      const key = component_id ? `${component}-${component_id}` : component

      await supabase
        .from('system_status')
        .upsert({
          id: key,
          component,
          component_id,
          status,
          message,
          metadata,
          updated_at: new Date().toISOString()
        })
    }

    return successResponse({ updated: updates.length })
  } catch (error) {
    console.error('POST /api/ai/system-status error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withApiKeyAuth(handleGET)
export const POST = withApiKeyAuth(handlePOST)

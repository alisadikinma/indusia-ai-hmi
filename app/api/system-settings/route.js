/**
 * System Settings API
 * GET  /api/system-settings         - Get all settings (public)
 * PUT  /api/system-settings         - Update settings (superadmin only)
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { withAuth } from '@/lib/auth/apiAuth'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')

    if (error) throw error

    // Convert rows to object: { company_name: 'PCI Batam', company_logo: '...' }
    const settings = {}
    for (const row of (data || [])) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('[API] GET /system-settings error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function handlePUT(request) {
  try {
    const body = await request.json()
    const userId = request.user?.id || request.user?.userId

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be an object of key-value pairs' },
        { status: 400 }
      )
    }

    // Validate company_logo size if provided
    if (body.company_logo && body.company_logo.length > 400000) {
      return NextResponse.json(
        { success: false, error: 'Logo too large. Maximum size is 200KB.' },
        { status: 400 }
      )
    }

    // Upsert each key-value pair
    const entries = Object.entries(body)
    for (const [key, value] of entries) {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key,
          value: value ?? null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }, { onConflict: 'key' })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${entries.length} setting(s)`,
    })
  } catch (error) {
    console.error('[API] PUT /system-settings error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const PUT = withAuth('system:configure')(handlePUT)

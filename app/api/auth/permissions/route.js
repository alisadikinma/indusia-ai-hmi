/**
 * GET /api/auth/permissions
 * Get menu permissions for current user's role
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'roleId is required' },
        { status: 400 }
      )
    }

    // Get menu permissions for this role
    const { data: permissions, error } = await supabase
      .from('role_menu_permissions')
      .select('menu_id')
      .eq('role_id', roleId)

    if (error) {
      console.error('[auth/permissions]', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Return array of menu_ids
    const menuIds = permissions?.map(p => p.menu_id) || []

    return NextResponse.json({
      success: true,
      data: menuIds
    })
  } catch (error) {
    console.error('[auth/permissions]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

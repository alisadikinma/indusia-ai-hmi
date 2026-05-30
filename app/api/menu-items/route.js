import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { withAuth } from '@/lib/auth/apiAuth'

/**
 * GET /api/menu-items
 * Returns all menu items from DB
 * Requires permissions:read permission
 */
async function handleGET() {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, path')
      .order('name')

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('[GET /api/menu-items] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch menu items' },
      { status: 500 }
    )
  }
}

export const GET = withAuth('permissions:read')(handleGET)

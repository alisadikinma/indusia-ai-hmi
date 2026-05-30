/**
 * User Avatar API
 * PUT /api/users/me/avatar - Upload own avatar (any authenticated user)
 * DELETE /api/users/me/avatar - Remove own avatar
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { withAuth } from '@/lib/auth/apiAuth'

async function handlePUT(request) {
  try {
    const userId = request.user?.id || request.user?.userId
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { avatar_base64 } = body

    if (!avatar_base64) {
      return NextResponse.json(
        { success: false, error: 'avatar_base64 is required' },
        { status: 400 }
      )
    }

    // Validate base64 data URI format
    if (!avatar_base64.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format. Must be a data URI.' },
        { status: 400 }
      )
    }

    // Limit size (~200KB file = ~270KB base64)
    if (avatar_base64.length > 400000) {
      return NextResponse.json(
        { success: false, error: 'Avatar too large. Maximum size is 200KB.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('users')
      .update({ avatar_base64 })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Avatar updated' })
  } catch (error) {
    console.error('[API] PUT /users/me/avatar error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function handleDELETE(request) {
  try {
    const userId = request.user?.id || request.user?.userId
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('users')
      .update({ avatar_base64: null })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Avatar removed' })
  } catch (error) {
    console.error('[API] DELETE /users/me/avatar error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const PUT = withAuth()(handlePUT)
export const DELETE = withAuth()(handleDELETE)

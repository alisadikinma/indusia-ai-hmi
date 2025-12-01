import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'

/**
 * GET /api/users
 * Query params: role, section, status
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      role: searchParams.get('role'),
      section: searchParams.get('section'),
      status: searchParams.get('status')
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key]
    })

    const result = await usersRepo.list(filters)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data?.length || 0
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Body: { name, email, role, sections, whatsapp, status, password, ... }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, email, role' },
        { status: 400 }
      )
    }

    const result = await usersRepo.create(body)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

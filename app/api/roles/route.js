import { NextResponse } from 'next/server'
import * as rolesRepo from '@/lib/repos/rolesRepo'

/**
 * GET /api/roles
 */
export async function GET() {
  try {
    const result = await rolesRepo.list()

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
 * POST /api/roles
 * Body: { id, name, description, isSystem }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.id || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, name' },
        { status: 400 }
      )
    }

    const result = await rolesRepo.create(body)

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

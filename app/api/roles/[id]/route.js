import { NextResponse } from 'next/server'
import * as rolesRepo from '@/lib/repos/rolesRepo'

/**
 * GET /api/roles/:id
 */
export async function GET(request, { params }) {
  try {
    const { id } = params
    const result = await rolesRepo.getById(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/roles/:id
 * Body: { name, description }
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    const result = await rolesRepo.update(id, body)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/roles/:id
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    const result = await rolesRepo.delete(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

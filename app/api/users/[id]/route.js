import { NextResponse } from 'next/server'
import * as usersRepo from '@/lib/repos/usersRepo'

/**
 * GET /api/users/:id
 */
export async function GET(request, { params }) {
  try {
    const { id } = params
    const result = await usersRepo.getById(id)

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
 * PATCH /api/users/:id
 * Body: { name, email, role, sections, ... }
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

    const result = await usersRepo.update(id, body)

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
 * DELETE /api/users/:id (soft delete)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    const result = await usersRepo.delete(id)

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

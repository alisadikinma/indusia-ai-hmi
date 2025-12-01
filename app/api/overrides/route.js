import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'

/**
 * GET /api/overrides
 * Query params: status, section_id, customer_id, from, to, page, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      status: searchParams.get('status'),
      sectionId: searchParams.get('section_id'),
      customerId: searchParams.get('customer_id'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      page: parseInt(searchParams.get('page')) || 1,
      limit: parseInt(searchParams.get('limit')) || 20
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key]
    })

    const result = await overridesRepo.list(filters)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/overrides
 * Body: { boardId, defectType, reason, operatorNotes, submittedBy, ... }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.boardId || !body.defectType || !body.reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: boardId, defectType, reason' },
        { status: 400 }
      )
    }

    const result = await overridesRepo.create(body)

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

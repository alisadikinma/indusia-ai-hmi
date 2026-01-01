import { NextResponse } from 'next/server'
import * as defectClassesRepo from '@/lib/repos/defectClassesRepo'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'

/**
 * GET /api/defect-classes
 * Query params: active (default: true)
 * Returns list of defect classes
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const result = await defectClassesRepo.getAll(activeOnly)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error) {
    console.error('[GET /api/defect-classes] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/defect-classes
 * Body: { code, name, severity, color }
 * Creates a new defect class
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body)

    // Basic validation
    const { code, name, severity, color } = sanitizedBody
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Code and name are required' },
        { status: 400 }
      )
    }

    const result = await defectClassesRepo.create({ code, name, severity, color })

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
    console.error('[POST /api/defect-classes] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

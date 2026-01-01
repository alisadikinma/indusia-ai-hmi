import { NextResponse } from 'next/server'

/**
 * GET /api/test - Simple test endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  })
}

/**
 * POST /api/test - Test POST with body
 */
export async function POST(request) {
  try {
    const body = await request.json()
    return NextResponse.json({
      success: true,
      received: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 400 })
  }
}

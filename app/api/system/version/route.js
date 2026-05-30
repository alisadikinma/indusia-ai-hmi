import { NextResponse } from 'next/server'
import { getBuildInfo } from '@/lib/utils/version'

export async function GET() {
  try {
    const buildInfo = getBuildInfo()
    return NextResponse.json({ success: true, data: buildInfo })
  } catch (error) {
    console.error('[Version API] Error:', error.message)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve version info' },
      { status: 500 }
    )
  }
}

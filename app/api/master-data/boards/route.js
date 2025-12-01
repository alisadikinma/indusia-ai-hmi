import { NextResponse } from 'next/server'
import * as masterDataRepo from '@/lib/repos/masterDataRepo'

/**
 * GET /api/master-data/boards
 * Query params: customer_id
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      customerId: searchParams.get('customer_id')
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key]
    })

    const result = await masterDataRepo.getBoards(filters)

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

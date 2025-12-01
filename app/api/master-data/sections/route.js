import { NextResponse } from 'next/server'
import * as masterDataRepo from '@/lib/repos/masterDataRepo'

/**
 * GET /api/master-data/sections
 * Query params: customer_id (optional - returns sections for that customer)
 * Returns all sections or sections for a specific customer
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')

    let result
    if (customerId) {
      result = await masterDataRepo.getSectionsForCustomer(customerId)
    } else {
      result = await masterDataRepo.getSections()
    }

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

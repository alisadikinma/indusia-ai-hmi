import { NextResponse } from 'next/server'
import * as masterDataRepo from '@/lib/repos/masterDataRepo'

/**
 * GET /api/master-data/customers
 * Returns all customers
 */
export async function GET() {
  try {
    const result = await masterDataRepo.getCustomers()

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

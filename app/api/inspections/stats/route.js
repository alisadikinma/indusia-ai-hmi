/**
 * Inspection Statistics API
 * GET /api/inspections/stats - Get inspection statistics
 */

import { NextResponse } from 'next/server';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      lineId: searchParams.get('lineId'),
      sectionId: searchParams.get('sectionId'),
      shift: searchParams.get('shift'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
    };

    const result = await inspectionRepo.getStats(filters);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('[API] GET /api/inspections/stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

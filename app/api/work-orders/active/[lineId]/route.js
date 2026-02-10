/**
 * Active Work Order by Line API Route
 * GET /api/work-orders/active/[lineId] - Get active work order for a line
 * 
 * Note: This endpoint is public (no auth required) as it's used for display
 * in LiveView by all roles including view-only users.
 */

import { NextResponse } from 'next/server';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';

/**
 * GET /api/work-orders/active/[lineId]
 * Get the active work order for a specific line
 * Returns null if no active WO found
 */
export async function GET(request, { params }) {
  try {
    const { lineId } = await params;

    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Line ID is required' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.getActiveByLine(lineId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Return success even if no active WO (data will be null)
    return NextResponse.json({
      success: true,
      data: result.data,
      hasActiveWO: result.data !== null,
      lastCompleted: result.lastCompleted || null,
    });
  } catch (error) {
    console.error('[API] GET /work-orders/active/[lineId] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

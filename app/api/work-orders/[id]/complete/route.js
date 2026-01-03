/**
 * Complete Work Order API Route
 * POST /api/work-orders/[id]/complete - Complete work order
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';

/**
 * POST /api/work-orders/[id]/complete
 * Complete work order - sets status to 'completed'
 */
async function handlePOST(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    // Check current status
    const currentWO = await workOrderRepo.getById(id);
    if (!currentWO.success || !currentWO.data) {
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    if (currentWO.data.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Can only complete active work orders' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.complete(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Work order completed',
    });
  } catch (error) {
    console.error('[API] POST /work-orders/[id]/complete error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth middleware
export const POST = withAuth('work-orders:update')(handlePOST);

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

    if (currentWO.data.status !== 'active' && currentWO.data.status !== 'on_hold') {
      return NextResponse.json(
        { success: false, error: 'Can only complete active or on-hold work orders' },
        { status: 400 }
      );
    }

    // Parse optional body for completion reason
    let reason = null;
    try {
      const body = await request.json();
      reason = body.reason || null;
    } catch {
      // No body provided — allowed for 100% complete WOs
    }

    // Require reason if WO is not fully completed
    const wo = currentWO.data;
    const isIncomplete = wo.completedQty < wo.lotSize;
    if (isIncomplete && !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Reason is required for incomplete work orders' },
        { status: 400 }
      );
    }

    // Always use authenticated user — never trust client-provided completedBy
    const completedBy = request.user?.id || request.user?.userId || null;

    const result = await workOrderRepo.complete(id, { reason, completedBy });

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

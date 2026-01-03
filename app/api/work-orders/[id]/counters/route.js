/**
 * Work Order Counters API Route
 * PUT /api/work-orders/[id]/counters - Update work order counters
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';
import { updateCountersSchema } from '@/lib/validations/workOrderSchema';

/**
 * PUT /api/work-orders/[id]/counters
 * Update work order counters (goodQty, ngQty, falseCallQty, completedQty)
 * Values are INCREMENTED, not replaced
 */
async function handlePUT(request, { params }) {
  try {
    const { id } = await params;
    const body = sanitizeRequestBody(await request.json());

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    // Validate input
    const validation = validate(updateCountersSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Check if WO exists and is active
    const currentWO = await workOrderRepo.getById(id);
    if (!currentWO.success || !currentWO.data) {
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    if (currentWO.data.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Can only update counters for active work orders' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.updateCounters(id, validation.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Check if WO was auto-completed
    const wasCompleted = result.data.status === 'completed' && currentWO.data.status === 'active';

    return NextResponse.json({
      success: true,
      data: result.data,
      message: wasCompleted ? 'Work order completed (lot size reached)' : 'Counters updated',
      autoCompleted: wasCompleted,
    });
  } catch (error) {
    console.error('[API] PUT /work-orders/[id]/counters error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth middleware
export const PUT = withAuth('work-orders:update')(handlePUT);

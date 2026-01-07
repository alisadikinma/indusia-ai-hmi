/**
 * Work Order Detail API Route
 * GET /api/work-orders/[id] - Get work order by ID
 * PUT /api/work-orders/[id] - Update work order
 * DELETE /api/work-orders/[id] - Delete work order
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';
import { updateWorkOrderSchema } from '@/lib/validations/workOrderSchema';
import { notifyWorkOrderStarted, notifyWorkOrderCompleted } from '@/lib/notificationHelper';

/**
 * GET /api/work-orders/[id]
 * Get work order by ID
 */
async function handleGET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.getById(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[API] GET /work-orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/work-orders/[id]
 * Update work order
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
    const validation = validate(updateWorkOrderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Get current WO to check status change
    const currentWO = await workOrderRepo.getById(id);
    const previousStatus = currentWO?.data?.status;
    const newStatus = validation.data.status;

    const result = await workOrderRepo.update(id, validation.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Send notifications on status change (non-blocking)
    if (newStatus && previousStatus !== newStatus) {
      const woData = result.data || currentWO?.data;
      
      if (newStatus === 'active' && previousStatus !== 'active') {
        // WO Started
        notifyWorkOrderStarted(woData)
          .catch(err => console.error('[Notification] Failed to notify WO start:', err));
      } else if (newStatus === 'completed' && previousStatus !== 'completed') {
        // WO Completed
        notifyWorkOrderCompleted(woData, {
          goodQty: woData?.goodQty || woData?.good_qty || 0,
          ngQty: woData?.ngQty || woData?.ng_qty || 0,
          falseCallQty: woData?.falseCallQty || woData?.false_call_qty || 0
        }).catch(err => console.error('[Notification] Failed to notify WO complete:', err));
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[API] PUT /work-orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-orders/[id]
 * Delete work order (draft only)
 */
async function handleDELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.delete(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Work order deleted',
    });
  } catch (error) {
    console.error('[API] DELETE /work-orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth middleware
export const GET = withAuth('work-orders:read')(handleGET);
export const PUT = withAuth('work-orders:update')(handlePUT);
export const DELETE = withAuth('work-orders:delete')(handleDELETE);

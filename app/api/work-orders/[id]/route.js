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
import fs from 'fs';
import pathModule from 'path';

const STATE_FILE = pathModule.join(process.cwd(), '.line-state.json');

/**
 * Read line state from the shared state file
 * Returns processStatus for a given lineId, or null if not found
 */
function getLineProcessStatus(lineId) {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    const entries = new Map(JSON.parse(data));
    const state = entries.get(lineId);
    return state?.processStatus || null;
  } catch {
    return null;
  }
}

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

    // Get current WO to check status change and production guard
    const currentWO = await workOrderRepo.getById(id);
    const previousStatus = currentWO?.data?.status;
    const newStatus = validation.data.status;

    // Guard: WOs with production (completedQty >= 1) can only change status
    const hasProduction = (currentWO?.data?.completedQty || 0) >= 1;
    if (hasProduction) {
      const dataKeys = Object.keys(validation.data);
      const nonStatusKeys = dataKeys.filter(k => k !== 'status');

      if (nonStatusKeys.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Work order with production history can only change status' },
          { status: 400 }
        );
      }

      if (newStatus && !['on_hold', 'completed', 'active'].includes(newStatus)) {
        return NextResponse.json(
          { success: false, error: 'Work order with production can only be set to on_hold, active, or completed' },
          { status: 400 }
        );
      }
    }

    // Guard: on_hold requires machine to be STOPPED (not RUNNING)
    if (newStatus === 'on_hold' && previousStatus === 'active') {
      const lineId = currentWO?.data?.lineId;
      if (lineId) {
        const machineStatus = getLineProcessStatus(lineId);
        if (machineStatus === 'RUNNING') {
          return NextResponse.json(
            { success: false, error: 'Mesin masih RUNNING. Stop mesin terlebih dahulu sebelum mengubah status ke On Hold.' },
            { status: 400 }
          );
        }
      }
    }

    // Guard: resuming from on_hold → check no other active WO on same line
    if (newStatus === 'active' && previousStatus === 'on_hold') {
      const lineId = currentWO?.data?.lineId;
      if (lineId) {
        const activeCheck = await workOrderRepo.getActiveByLine(lineId);
        if (activeCheck?.data && activeCheck.data.id !== id) {
          return NextResponse.json(
            { success: false, error: `Cannot resume: line already has active WO ${activeCheck.data.woNumber}` },
            { status: 400 }
          );
        }
      }
    }

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

/**
 * Work Orders API Route
 * GET /api/work-orders - List work orders
 * POST /api/work-orders - Create work order
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';
import { 
  createWorkOrderSchema, 
  workOrderFilterSchema 
} from '@/lib/validations/workOrderSchema';

/**
 * GET /api/work-orders
 * List work orders with filters
 */
async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query params
    const filters = {
      status: searchParams.get('status') || undefined,
      lineId: searchParams.get('lineId') || undefined,
      sectionId: searchParams.get('sectionId') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
      orderBy: searchParams.get('orderBy') || 'created_at',
      orderDirection: searchParams.get('orderDirection') || 'desc',
    };

    // Handle multiple status values
    const statusParam = searchParams.getAll('status');
    if (statusParam.length > 1) {
      filters.status = statusParam;
    }

    // Validate filters
    const validation = validate(workOrderFilterSchema, filters);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.getAll(validation.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
    });
  } catch (error) {
    console.error('[API] GET /work-orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders
 * Create new work order
 */
async function handlePOST(request) {
  try {
    const body = sanitizeRequestBody(await request.json());

    // Validate input
    const validation = validate(createWorkOrderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Add created_by from authenticated user
    const data = {
      ...validation.data,
      createdBy: request.user?.id,
    };

    const result = await workOrderRepo.create(data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] POST /work-orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth middleware
export const GET = withAuth('work-orders:read')(handleGET);
export const POST = withAuth('work-orders:create')(handlePOST);

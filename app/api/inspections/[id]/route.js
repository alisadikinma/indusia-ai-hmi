/**
 * Single Inspection API
 * GET  /api/inspections/[id] - Get inspection by ID
 * PUT  /api/inspections/[id] - Update inspection decision
 */

import { NextResponse } from 'next/server';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

// GET - Get inspection by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Inspection ID is required' },
        { status: 400 }
      );
    }

    const result = await inspectionRepo.getById(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('[API] GET /api/inspections/[id] error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update inspection decision
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Inspection ID is required' },
        { status: 400 }
      );
    }

    // Validate operator decision
    const validDecisions = ['APPROVE', 'REJECT', 'FALSE_CALL'];
    if (body.operatorDecision && !validDecisions.includes(body.operatorDecision)) {
      return NextResponse.json(
        { success: false, error: `Invalid operatorDecision. Must be one of: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await inspectionRepo.updateDecision(id, body);

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
    console.error('[API] PUT /api/inspections/[id] error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Inspections API
 * GET  /api/inspections - List inspections with filters
 * POST /api/inspections - Create new inspection result
 */

import { NextResponse } from 'next/server';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

// GET - List inspections
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      lineId: searchParams.get('lineId'),
      sectionId: searchParams.get('sectionId'),
      customerId: searchParams.get('customerId'),
      aiResult: searchParams.get('aiResult'),
      operatorDecision: searchParams.get('operatorDecision'),
      operatorId: searchParams.get('operatorId'),
      boardId: searchParams.get('boardId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      limit: parseInt(searchParams.get('limit')) || 50,
      offset: parseInt(searchParams.get('offset')) || 0,
      orderBy: searchParams.get('orderBy') || 'inspection_timestamp',
      orderDirection: searchParams.get('orderDirection') || 'desc',
    };

    const result = await inspectionRepo.getAll(filters);

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
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: result.count,
      },
    });

  } catch (error) {
    console.error('[API] GET /api/inspections error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new inspection
export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.boardId) {
      return NextResponse.json(
        { success: false, error: 'boardId is required' },
        { status: 400 }
      );
    }

    if (!body.aiResult) {
      return NextResponse.json(
        { success: false, error: 'aiResult is required' },
        { status: 400 }
      );
    }

    const result = await inspectionRepo.create(body);

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
    console.error('[API] POST /api/inspections error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Defect Classes API
 * GET /api/inspections/defect-classes - Get all defect class options
 */

import { NextResponse } from 'next/server';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

export async function GET() {
  try {
    const result = await inspectionRepo.getDefectClasses();

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
    console.error('[API] GET /api/inspections/defect-classes error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * False Call Reasons API
 * GET /api/inspections/false-call-reasons - Get all false call reason options
 */

import { NextResponse } from 'next/server';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

export async function GET() {
  try {
    const result = await inspectionRepo.getFalseCallReasons();

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
    console.error('[API] GET /api/inspections/false-call-reasons error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

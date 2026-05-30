/**
 * GET /api/work-orders/check-number?woNumber=WO-20260225-0001
 * Check if a WO number is available (not already in use)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const woNumber = searchParams.get('woNumber');

    if (!woNumber || !woNumber.trim()) {
      return NextResponse.json(
        { success: false, error: 'woNumber parameter is required' },
        { status: 400 }
      );
    }

    const result = await workOrderRepo.checkNumberAvailable(woNumber.trim());

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { available: result.available, woNumber: woNumber.trim() },
    });
  } catch (error) {
    console.error('[API] GET /work-orders/check-number error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withAuth('work-orders:create')(handleGET);

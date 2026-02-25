/**
 * GET /api/work-orders/next-number
 * Generate and return the next sequential WO number
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { workOrderRepo } from '@/lib/repos/workOrderRepo';

async function handleGET() {
  try {
    const woNumber = await workOrderRepo.generateNextNumber();
    return NextResponse.json({ success: true, data: { woNumber } });
  } catch (error) {
    console.error('[API] GET /work-orders/next-number error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate WO number' },
      { status: 500 }
    );
  }
}

export const GET = withAuth('work-orders:create')(handleGET);

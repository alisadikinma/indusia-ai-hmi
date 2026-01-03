/**
 * System Health API
 * GET /api/system-health - Get system health status
 */

import { NextResponse } from 'next/server';
import { systemHealthRepo } from '@/lib/repos/systemHealthRepo';

export async function GET() {
  try {
    const result = await systemHealthRepo.getSystemHealth();
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[API] GET /api/system-health error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

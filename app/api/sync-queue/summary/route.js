/**
 * Sync Queue Summary API
 * GET /api/sync-queue/summary - Get queue summary stats
 */

import { NextResponse } from 'next/server';
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo';

export async function GET() {
  try {
    const result = await syncQueueRepo.getQueueSummary();
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[API] GET /api/sync-queue/summary error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

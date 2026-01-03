/**
 * Sync History API
 * GET /api/sync-queue/history - Get sync history
 */

import { NextResponse } from 'next/server';
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10;

    const result = await syncQueueRepo.getSyncHistory(limit);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[API] GET /api/sync-queue/history error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

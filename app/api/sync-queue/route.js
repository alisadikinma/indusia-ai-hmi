/**
 * Sync Queue API
 * GET  /api/sync-queue - Get pending sync items
 * POST /api/sync-queue - Add item to queue
 */

import { NextResponse } from 'next/server';
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo';

// GET - Get pending sync items
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const result = await syncQueueRepo.getGroupedQueueItems();
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    const result = await syncQueueRepo.getPendingItems();
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
    console.error('[API] GET /api/sync-queue error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Add item to sync queue
export async function POST(request) {
  try {
    const body = await request.json();

    const result = await syncQueueRepo.addToQueue(body);
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
    console.error('[API] POST /api/sync-queue error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

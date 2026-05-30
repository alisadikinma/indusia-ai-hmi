/**
 * Inspection Stats API
 * GET: Get statistics for line, operator, or session
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

export const dynamic = 'force-dynamic';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');
    const operatorId = searchParams.get('operatorId');
    const sessionId = searchParams.get('sessionId');
    const days = parseInt(searchParams.get('days') || '7', 10);

    let result;

    if (sessionId) {
      // Get stats for specific session
      result = await inspectionRepo.getSessionStats(sessionId);
    } else if (lineId) {
      // Get stats for line (today by default)
      result = await inspectionRepo.getLineStats(lineId);
    } else if (operatorId) {
      // Get stats for specific operator
      result = await inspectionRepo.getOperatorStats(operatorId, days);
    } else {
      // Default: current user stats
      result = await inspectionRepo.getOperatorStats(request.user.id, days);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('GET /api/inspection/stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}

export const GET = withAuth('inspection:read')(handleGET);

/**
 * Inspection Models API (browser-accessible)
 * GET: List models for operator selection (all statuses by default)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { aiModelsRepo } from '@/lib/repos/aiModelsRepo';

export const dynamic = 'force-dynamic';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get('status') || null,
      name: searchParams.get('name'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    };

    const result = await aiModelsRepo.list(filters);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('GET /api/inspection/models error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const GET = withAuth()(handleGET);

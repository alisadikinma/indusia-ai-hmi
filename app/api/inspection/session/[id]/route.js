/**
 * Inspection Session by ID
 * GET: Get session details
 * PUT: Update session (pause/resume/end)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate, validationErrorResponse } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const updateSessionSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'abandoned'], {
    errorMap: () => ({ message: 'Invalid status. Must be active, paused, completed, or abandoned' }),
  }),
  pauseTimeMs: z.number().min(0).optional(),
});

async function handleGET(request, { params }) {
  try {
    const { id } = await params;

    const result = await inspectionRepo.getSession(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('GET /api/inspection/session/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

async function handlePUT(request, { params }) {
  try {
    const { id } = await params;
    const body = sanitizeRequestBody(await request.json());
    const validation = validate(updateSessionSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    let result;
    if (validation.data.status === 'completed') {
      result = await inspectionRepo.endSession(id);
    } else {
      result = await inspectionRepo.updateSessionStatus(
        id,
        validation.data.status,
        validation.data.pauseTimeMs
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PUT /api/inspection/session/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export const GET = withAuth('inspection:read')(handleGET);
export const PUT = withAuth('inspection:update')(handlePUT);

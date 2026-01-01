/**
 * Inspection Session API
 * POST: Start new session
 * GET: Get active session for current user
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate, validationErrorResponse } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const startSessionSchema = z.object({
  lineId: z.string().uuid('Invalid line ID'),
  boardId: z.string().uuid('Invalid board ID').optional(),
});

async function handlePOST(request) {
  try {
    const body = sanitizeRequestBody(await request.json());
    const validation = validate(startSessionSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const operatorId = request.user.id;

    // Check for existing active session
    const existing = await inspectionRepo.getActiveSession(operatorId);
    if (existing.success && existing.data) {
      // End previous session first
      await inspectionRepo.endSession(existing.data.id);
    }

    const result = await inspectionRepo.startSession({
      operatorId,
      lineId: validation.data.lineId,
      boardId: validation.data.boardId,
    });

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
    console.error('POST /api/inspection/session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start session' },
      { status: 500 }
    );
  }
}

async function handleGET(request) {
  try {
    const operatorId = request.user.id;

    const result = await inspectionRepo.getActiveSession(operatorId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('GET /api/inspection/session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

export const POST = withAuth('inspection:create')(handlePOST);
export const GET = withAuth('inspection:read')(handleGET);

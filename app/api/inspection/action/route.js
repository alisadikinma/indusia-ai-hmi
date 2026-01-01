/**
 * Inspection Action API
 * POST: Record operator decision (approve/reject/false_call/auto_approve)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate, validationErrorResponse } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const actionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  boardId: z.string().uuid('Invalid board ID'),
  lineId: z.string().uuid('Invalid line ID'),
  sectionId: z.string().uuid('Invalid section ID').optional().nullable(),
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),

  // Frame data
  frameId: z.string().uuid('Invalid frame ID').optional().nullable(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable(),

  // AI detection
  aiResult: z.enum(['pass', 'fail', 'review']).optional().nullable(),
  aiConfidence: z.number().min(0).max(1).optional().nullable(),
  aiDefectType: z.string().max(100).optional().nullable(),
  aiDetections: z.array(z.any()).optional().nullable(),

  // Operator action
  action: z.enum(['approve', 'reject', 'false_call', 'auto_approve'], {
    errorMap: () => ({ message: 'Invalid action. Must be approve, reject, false_call, or auto_approve' }),
  }),
  notes: z.string().max(500).optional().nullable(),

  // Timing
  decisionTimeMs: z.number().min(0).optional().nullable(),
});

async function handlePOST(request) {
  try {
    const body = sanitizeRequestBody(await request.json());
    const validation = validate(actionSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data;
    const operatorId = request.user.id;

    const result = await inspectionRepo.recordResult({
      sessionId: data.sessionId,
      boardId: data.boardId,
      lineId: data.lineId,
      sectionId: data.sectionId,
      customerId: data.customerId,
      frameId: data.frameId,
      imageUrl: data.imageUrl,
      aiResult: data.aiResult,
      aiConfidence: data.aiConfidence,
      aiDefectType: data.aiDefectType,
      aiDetections: data.aiDetections,
      operatorAction: data.action,
      operatorId,
      operatorNotes: data.notes,
      decisionTimeMs: data.decisionTimeMs,
      autoApproved: data.action === 'auto_approve',
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
    console.error('POST /api/inspection/action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record action' },
      { status: 500 }
    );
  }
}

export const POST = withAuth('inspection:create')(handlePOST);

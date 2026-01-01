/**
 * Inspection Validation Schemas
 * Zod schemas for inspection API input validation
 */

import { z } from 'zod';

/**
 * Schema for starting a new inspection session
 */
export const startSessionSchema = z.object({
  lineId: z.string().uuid('Invalid line ID'),
  boardId: z.string().uuid('Invalid board ID').optional(),
});

/**
 * Schema for updating session status
 */
export const updateSessionSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'abandoned'], {
    errorMap: () => ({ message: 'Invalid status. Must be active, paused, completed, or abandoned' }),
  }),
  pauseTimeMs: z.number().min(0, 'Pause time must be non-negative').optional(),
});

/**
 * Schema for recording inspection action
 */
export const inspectionActionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  boardId: z.string().uuid('Invalid board ID'),
  lineId: z.string().uuid('Invalid line ID'),
  sectionId: z.string().uuid('Invalid section ID').optional().nullable(),
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),

  // Frame reference
  frameId: z.string().uuid('Invalid frame ID').optional().nullable(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable(),

  // AI detection data
  aiResult: z.enum(['pass', 'fail', 'review']).optional().nullable(),
  aiConfidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1').optional().nullable(),
  aiDefectType: z.string().max(100, 'Defect type too long').optional().nullable(),
  aiDetections: z.array(z.any()).optional().nullable(),

  // Operator action
  action: z.enum(['approve', 'reject', 'false_call', 'auto_approve'], {
    errorMap: () => ({ message: 'Invalid action type. Must be approve, reject, false_call, or auto_approve' }),
  }),
  notes: z.string().max(500, 'Notes too long').optional().nullable(),

  // Timing
  decisionTimeMs: z.number().min(0, 'Decision time must be non-negative').optional().nullable(),
});

/**
 * Schema for linking override to inspection result
 */
export const linkOverrideSchema = z.object({
  resultId: z.string().uuid('Invalid result ID'),
  overrideId: z.string().uuid('Invalid override ID'),
});

/**
 * Schema for stats query parameters
 */
export const statsQuerySchema = z.object({
  lineId: z.string().uuid('Invalid line ID').optional(),
  operatorId: z.string().uuid('Invalid operator ID').optional(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
  days: z.coerce.number().min(1).max(365).default(7),
});

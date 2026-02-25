/**
 * Work Order Validation Schemas
 * Zod schemas for work order API inputs
 */

import { z } from 'zod';

/**
 * Create work order schema
 */
export const createWorkOrderSchema = z.object({
  woNumber: z.string().min(1).max(30).regex(/^[a-zA-Z0-9\-_]+$/, 'Only letters, numbers, dash and underscore allowed').optional(),
  customerId: z.string().min(1, 'Customer is required'),
  boardId: z.string().min(1, 'Board is required'),
  lineId: z.string().min(1, 'Line is required'),
  sectionId: z.string().optional(),
  lotSize: z.coerce.number().int().min(1, 'Lot size must be at least 1'),
  sideCount: z.coerce.number().int().min(1).max(2).default(1),
  dueDate: z.string().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  notes: z.string().max(1000).optional(),
});

/**
 * Update work order schema
 */
export const updateWorkOrderSchema = z.object({
  customerId: z.string().min(1).optional(),
  boardId: z.string().min(1).optional(),
  lineId: z.string().min(1).optional(),
  sectionId: z.string().optional().nullable(),
  lotSize: z.coerce.number().int().min(1).optional(),
  sideCount: z.coerce.number().int().min(1).max(2).optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['draft', 'ready', 'active', 'on_hold', 'completed', 'closed']).optional(),
});

/**
 * Work order filter schema
 */
export const workOrderFilterSchema = z.object({
  status: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
  lineId: z.string().optional(),
  sectionId: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.string().default('created_at'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Update counters schema
 */
export const updateCountersSchema = z.object({
  goodQty: z.number().int().optional(),
  ngQty: z.number().int().optional(),
  falseCallQty: z.number().int().optional(),
  completedQty: z.number().int().optional(),
});

export default {
  createWorkOrderSchema,
  updateWorkOrderSchema,
  workOrderFilterSchema,
  updateCountersSchema,
};

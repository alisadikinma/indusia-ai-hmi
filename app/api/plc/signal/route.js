/**
 * PLC Signal API Endpoint
 * Receives signal requests from HMI and forwards to PLC via Serial RS232
 * 
 * SECURITY: Requires authentication and plc:control permission
 * 
 * In development: Simulates PLC communication with logging
 * In production: Connect to actual RS232 gateway service
 * 
 * POST /api/plc/signal
 * Body: { lineId, signal, boardId, side?, reason?, woNumber?, boardSequence?, timestamp }
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { z } from 'zod';

// PLC Signal types
const VALID_SIGNALS = ['GOOD', 'NG', 'FLIP_BOTTOM', 'NEXT_PCB', 'NEXT'];

// Validation schema
const plcSignalSchema = z.object({
  lineId: z.string().min(1).max(50),
  signal: z.enum(VALID_SIGNALS),
  boardId: z.string().max(100).optional(),
  side: z.enum(['TOP', 'BOTTOM']).optional(),
  reason: z.string().max(500).optional(),
  woNumber: z.string().max(50).optional(),
  boardSequence: z.number().int().positive().optional(),
  timestamp: z.string().datetime().optional()
}).strict();

// Simulated RS232 command map
const RS232_COMMANDS = {
  GOOD: 'CMD:GOOD\r\n',           // Side passed - continue
  NG: 'CMD:NG\r\n',               // PCB rejected - activate reject gate
  FLIP_BOTTOM: 'CMD:FLIP\r\n',    // Flip board to inspect bottom
  NEXT_PCB: 'CMD:NEXT\r\n',       // Full cycle complete - next PCB
  NEXT: 'CMD:NEXT\r\n',           // Legacy: same as NEXT_PCB
};

/**
 * Simulate sending command to PLC via RS232
 * In production, this would connect to a gateway service
 */
async function sendToRS232Gateway(command, lineId, metadata = {}) {
  // TODO: Replace with actual RS232 gateway communication
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[RS232] Line ${lineId}: Sending command: ${command.trim()}`);
    if (metadata.side) {
      console.log(`[RS232] Side: ${metadata.side}`);
    }
    if (metadata.woNumber) {
      console.log(`[RS232] WO: ${metadata.woNumber}, Board #${metadata.boardSequence}`);
    }
  }
  
  // Simulate transmission delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Simulate success (in production, check for ACK from PLC)
  return { success: true, ack: true };
}

/**
 * POST /api/plc/signal
 * Send signal to PLC
 * Requires plc:control permission
 */
async function handlePOST(request) {
  try {
    const rawBody = await request.json();
    const body = sanitizeRequestBody(rawBody);

    // Validate input
    const validation = plcSignalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { 
      lineId, 
      signal, 
      boardId, 
      side,
      reason, 
      woNumber,
      boardSequence,
      timestamp 
    } = validation.data;

    // Get RS232 command
    const command = RS232_COMMANDS[signal];
    
    // Log the signal request (with operator info from auth)
    if (process.env.NODE_ENV === 'development') {
      console.log('[PLC API] Signal request:', {
        lineId,
        signal,
        boardId,
        operatorId: request.user?.id,
        operatorName: request.user?.name,
        side: side || 'TOP',
        reason,
        woNumber,
        boardSequence,
        timestamp: timestamp || new Date().toISOString(),
      });
    }

    // Send to RS232 gateway
    const result = await sendToRS232Gateway(command, lineId, {
      side,
      woNumber,
      boardSequence,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'PLC communication failed' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        signal,
        lineId,
        boardId,
        side: side || 'TOP',
        woNumber,
        boardSequence,
        sentAt: new Date().toISOString(),
        ack: result.ack,
      },
    });

  } catch (error) {
    console.error('[PLC API] Error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plc/signal?lineId=xxx
 * Check PLC connection status
 * Requires plc:status permission
 */
async function handleGET(request) {
  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get('lineId');

  // In production, check actual RS232 connection status
  return NextResponse.json({
    success: true,
    data: {
      status: 'connected',
      lineId: lineId || 'all',
      lastPing: new Date().toISOString(),
      gateway: 'RS232-Gateway-v1',
      supportedSignals: VALID_SIGNALS,
    },
  });
}

// Apply authentication - requires plc permissions
export const POST = withAuth('plc:control')(handlePOST);
export const GET = withAuth('plc:status')(handleGET);

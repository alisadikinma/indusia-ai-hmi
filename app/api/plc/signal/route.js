/**
 * PLC Signal API Endpoint
 * Receives signal requests from HMI and forwards to PLC via Serial RS232
 * 
 * In development: Simulates PLC communication with logging
 * In production: Connect to actual RS232 gateway service
 * 
 * POST /api/plc/signal
 * Body: { lineId, signal, boardId, operatorId, side?, reason?, woNumber?, boardSequence?, timestamp }
 */

import { NextResponse } from 'next/server';

// PLC Signal types
const VALID_SIGNALS = ['GOOD', 'NG', 'FLIP_BOTTOM', 'NEXT_PCB', 'NEXT'];

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
  // Options:
  // 1. Local Node.js service with serialport library
  // 2. Python gateway service
  // 3. Edge device with REST API
  
  console.log(`[RS232] Line ${lineId}: Sending command: ${command.trim()}`);
  if (metadata.side) {
    console.log(`[RS232] Side: ${metadata.side}`);
  }
  if (metadata.woNumber) {
    console.log(`[RS232] WO: ${metadata.woNumber}, Board #${metadata.boardSequence}`);
  }
  
  // Simulate transmission delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Simulate success (in production, check for ACK from PLC)
  return { success: true, ack: true };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      lineId, 
      signal, 
      boardId, 
      operatorId, 
      side,
      reason, 
      woNumber,
      boardSequence,
      timestamp 
    } = body;

    // Validate required fields
    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'lineId is required' },
        { status: 400 }
      );
    }

    if (!signal || !VALID_SIGNALS.includes(signal)) {
      return NextResponse.json(
        { success: false, error: `Invalid signal. Must be one of: ${VALID_SIGNALS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get RS232 command
    const command = RS232_COMMANDS[signal];
    
    // Log the signal request
    console.log('[PLC API] Signal request:', {
      lineId,
      signal,
      boardId,
      operatorId,
      side: side || 'TOP',
      reason,
      woNumber,
      boardSequence,
      timestamp: timestamp || new Date().toISOString(),
    });

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

    // Log success
    console.log(`[PLC API] Signal ${signal} sent successfully to Line ${lineId}`);

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
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check PLC connection status
export async function GET(request) {
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

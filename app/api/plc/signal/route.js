/**
 * PLC Signal API Endpoint
 * Receives signal requests from HMI and forwards to PLC via Serial RS232
 * 
 * In development: Simulates PLC communication with logging
 * In production: Connect to actual RS232 gateway service
 * 
 * POST /api/plc/signal
 * Body: { lineId, signal, boardId, operatorId, reason?, timestamp }
 */

import { NextResponse } from 'next/server';

// PLC Signal types
const VALID_SIGNALS = ['GOOD', 'NG', 'NEXT'];

// Simulated RS232 command map
const RS232_COMMANDS = {
  GOOD: 'CMD:GOOD\r\n',   // PCB passed - continue conveyor
  NG: 'CMD:NG\r\n',       // PCB rejected - stop conveyor
  NEXT: 'CMD:NEXT\r\n',   // Ready for next PCB - resume conveyor
};

/**
 * Simulate sending command to PLC via RS232
 * In production, this would connect to a gateway service
 */
async function sendToRS232Gateway(command, lineId) {
  // TODO: Replace with actual RS232 gateway communication
  // Options:
  // 1. Local Node.js service with serialport library
  // 2. Python gateway service
  // 3. Edge device with REST API
  
  console.log(`[RS232] Line ${lineId}: Sending command: ${command.trim()}`);
  
  // Simulate transmission delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Simulate success (in production, check for ACK from PLC)
  return { success: true, ack: true };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { lineId, signal, boardId, operatorId, reason, timestamp } = body;

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
      reason,
      timestamp: timestamp || new Date().toISOString(),
    });

    // Send to RS232 gateway
    const result = await sendToRS232Gateway(command, lineId);

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
    },
  });
}

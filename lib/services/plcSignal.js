/**
 * PLC Signal Service
 * Handles communication with PLC via Serial RS232 gateway
 * 
 * Signal Types:
 * - GOOD: Board side passed inspection
 * - NG: Board rejected (defect confirmed)
 * - FLIP_BOTTOM: Flip board to inspect bottom side (2-side boards)
 * - NEXT_PCB: Ready for next board (after full inspection cycle)
 * 
 * Flow for 2-side PCB:
 *   TOP inspection → FLIP_BOTTOM → BOTTOM inspection → NEXT_PCB
 * 
 * Flow for 1-side PCB:
 *   TOP inspection → NEXT_PCB
 */

export const PLC_SIGNALS = {
  GOOD: 'GOOD',
  NG: 'NG',
  FLIP_BOTTOM: 'FLIP_BOTTOM',
  NEXT_PCB: 'NEXT_PCB',
  // Legacy (for backward compatibility)
  NEXT: 'NEXT',
};

/**
 * Send signal to PLC
 * @param {string} lineId - Production line ID
 * @param {string} signal - Signal type
 * @param {object} metadata - Additional data for logging
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPLCSignal(lineId, signal, metadata = {}) {
  const timestamp = new Date().toISOString();
  
  console.log(`[PLC] Sending signal:`, {
    lineId,
    signal,
    timestamp,
    ...metadata,
  });

  try {
    const response = await fetch('/api/plc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId,
        signal,
        timestamp,
        boardId: metadata.boardId,
        operatorId: metadata.operatorId,
        side: metadata.side,
        reason: metadata.reason,
        woNumber: metadata.woNumber,
        boardSequence: metadata.boardSequence,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'PLC signal failed');
    }

    console.log(`[PLC] Signal ${signal} sent successfully`);
    return { success: true };

  } catch (error) {
    console.error(`[PLC] Signal error:`, error);
    
    // For development: simulate success
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PLC] DEV MODE: Simulating successful ${signal} signal`);
      return { success: true, simulated: true };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Send GOOD signal - Board side passed inspection
 * @param {string} lineId - Line ID
 * @param {string} boardId - Board ID
 * @param {string} operatorId - Operator user ID
 * @param {string} side - 'TOP' or 'BOTTOM'
 */
export async function signalGood(lineId, boardId, operatorId, side = 'TOP') {
  return sendPLCSignal(lineId, PLC_SIGNALS.GOOD, { boardId, operatorId, side });
}

/**
 * Send NG signal - Board rejected
 * @param {string} lineId - Line ID
 * @param {string} boardId - Board ID
 * @param {string} operatorId - Operator user ID
 * @param {string} side - 'TOP' or 'BOTTOM'
 */
export async function signalNG(lineId, boardId, operatorId, side = 'TOP') {
  return sendPLCSignal(lineId, PLC_SIGNALS.NG, { boardId, operatorId, side });
}

/**
 * Send FLIP_BOTTOM signal - Flip board to inspect bottom side
 * Used for 2-side PCB inspection flow
 * @param {string} lineId - Line ID
 * @param {string} boardId - Board ID
 * @param {string} operatorId - Operator user ID
 */
export async function signalFlipBottom(lineId, boardId, operatorId) {
  return sendPLCSignal(lineId, PLC_SIGNALS.FLIP_BOTTOM, { 
    boardId, 
    operatorId,
    side: 'TOP', // Currently on TOP, flipping to BOTTOM
  });
}

/**
 * Send NEXT_PCB signal - Ready for next board
 * Sent after full inspection cycle is complete (all sides inspected)
 * @param {string} lineId - Line ID
 * @param {string} boardId - Board ID
 * @param {string} operatorId - Operator user ID
 * @param {string} side - Current side ('TOP' for 1-side, 'BOTTOM' for 2-side)
 * @param {object} woInfo - Work order info for logging
 */
export async function signalNextPCB(lineId, boardId, operatorId, side = 'TOP', woInfo = {}) {
  return sendPLCSignal(lineId, PLC_SIGNALS.NEXT_PCB, { 
    boardId, 
    operatorId,
    side,
    woNumber: woInfo.woNumber,
    boardSequence: woInfo.boardSequence,
  });
}

/**
 * Legacy: Send NEXT signal
 * @deprecated Use signalNextPCB instead
 */
export async function signalNext(lineId, boardId, operatorId, reason = null) {
  return sendPLCSignal(lineId, PLC_SIGNALS.NEXT, { boardId, operatorId, reason });
}

/**
 * Determine which PLC signal to send based on side count and current side
 * @param {number} sideCount - 1 or 2
 * @param {string} currentSide - 'TOP' or 'BOTTOM'
 * @param {string} result - 'GOOD' or 'NG'
 * @returns {{ signal: string, nextSide: string|null }}
 */
export function determinePLCSignal(sideCount, currentSide, result) {
  // If NG, always send NG signal
  if (result === 'NG') {
    return { signal: 'NG', nextSide: null };
  }
  
  // If GOOD (includes FALSE_CALL converted to GOOD)
  if (sideCount === 2 && currentSide === 'TOP') {
    // Need to inspect bottom
    return { signal: 'FLIP_BOTTOM', nextSide: 'BOTTOM' };
  }
  
  // Single side OR already inspected bottom
  return { signal: 'NEXT_PCB', nextSide: null };
}

export default {
  sendPLCSignal,
  signalGood,
  signalNG,
  signalFlipBottom,
  signalNextPCB,
  signalNext,
  determinePLCSignal,
  PLC_SIGNALS,
};

/**
 * PLC Signal Service
 * Handles communication with PLC via Serial RS232 gateway
 * 
 * Signal Types:
 * - GOOD: Board passed inspection (operator approved)
 * - NG: Board rejected (defect confirmed)
 * - NEXT: Ready for next board (after reject removal or false call)
 */

export const PLC_SIGNALS = {
  GOOD: 'GOOD',
  NG: 'NG',
  NEXT: 'NEXT',
};

/**
 * Send signal to PLC
 * @param {string} lineId - Production line ID
 * @param {string} signal - Signal type (GOOD/NG/NEXT)
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
    // TODO: Replace with actual PLC communication endpoint
    // This will call a local gateway service that handles RS232 communication
    const response = await fetch('/api/plc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId,
        signal,
        timestamp,
        boardId: metadata.boardId,
        operatorId: metadata.operatorId,
        reason: metadata.reason,
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
 * Send GOOD signal - Board approved
 */
export async function signalGood(lineId, boardId, operatorId) {
  return sendPLCSignal(lineId, PLC_SIGNALS.GOOD, { boardId, operatorId });
}

/**
 * Send NG signal - Board rejected
 */
export async function signalNG(lineId, boardId, operatorId) {
  return sendPLCSignal(lineId, PLC_SIGNALS.NG, { boardId, operatorId });
}

/**
 * Send NEXT signal - Ready for next board
 */
export async function signalNext(lineId, boardId, operatorId, reason = null) {
  return sendPLCSignal(lineId, PLC_SIGNALS.NEXT, { boardId, operatorId, reason });
}

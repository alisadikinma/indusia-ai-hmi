/**
 * Work Order Repository
 * Handles CRUD operations for production work orders
 */

import { supabase } from '@/lib/supabaseClient';

/**
 * In-memory mutex locks per WO ID.
 * Prevents concurrent read-then-write race conditions in updateWorkOrderCounters.
 * Without this, two overlapping counter updates can read the same base value and
 * both write base+1 (losing one increment).
 */
const woCounterLocks = new Map();

function acquireCounterLock(id) {
  if (!woCounterLocks.has(id)) {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    resolve(); // immediately resolved — first caller proceeds
    woCounterLocks.set(id, { promise, queue: [] });
  }

  const lock = woCounterLocks.get(id);
  const prevPromise = lock.promise;

  let releaseNext;
  lock.promise = new Promise(r => { releaseNext = r; });

  return {
    wait: prevPromise,
    release: () => {
      releaseNext();
      // Clean up if nobody else is waiting
      if (lock.queue.length === 0) {
        woCounterLocks.delete(id);
      }
    }
  };
}

/**
 * Generate next WO number
 * Format: WO-YYYYMMDD-XXXX
 * @returns {Promise<string>}
 */
async function generateWONumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `WO-${dateStr}-`;

  // Get latest WO number for today
  const { data, error } = await supabase
    .from('work_orders')
    .select('wo_number')
    .like('wo_number', `${prefix}%`)
    .order('wo_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[WorkOrderRepo] Generate WO number error:', error);
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  let nextSeq = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].wo_number;
    const lastSeq = parseInt(lastNum.split('-').pop(), 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Create a new work order
 * @param {Object} data - Work order data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createWorkOrder(data) {
  try {
    const {
      customerId,
      boardId,
      lineId,
      sectionId,
      lotSize,
      sideCount = 1,
      dueDate,
      priority = 0,
      notes,
      createdBy,
    } = data;

    const woNumber = await generateWONumber();

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        wo_number: woNumber,
        customer_id: customerId,
        board_id: boardId,
        line_id: lineId,
        section_id: sectionId,
        lot_size: lotSize,
        side_count: sideCount,
        due_date: dueDate || null,
        priority,
        notes,
        created_by: createdBy,
        status: 'draft',
      })
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `)
      .single();

    if (error) {
      console.error('[WorkOrderRepo] Create error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(workOrder) };
  } catch (error) {
    console.error('[WorkOrderRepo] Create error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get work order by ID
 * @param {string} id - Work order ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWorkOrderById(id) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name),
        created_by_user:users!work_orders_created_by_fkey(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(data) };
  } catch (error) {
    console.error('[WorkOrderRepo] Get by ID error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get work orders with filters
 * @param {Object} filters - Query filters
 * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
 */
export async function getWorkOrders(filters = {}) {
  try {
    const {
      status,
      lineId,
      sectionId,
      customerId,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc',
    } = filters;

    let query = supabase
      .from('work_orders')
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }
    if (lineId) query = query.eq('line_id', lineId);
    if (sectionId) query = query.eq('section_id', sectionId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data.map(transformWorkOrder),
      count,
    };
  } catch (error) {
    console.error('[WorkOrderRepo] Get work orders error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get active work order for a line
 * @param {string} lineId - Line ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getActiveWorkOrderByLine(lineId) {
  try {
    // Use .order().limit(1) instead of .single() to handle edge case
    // where multiple active WOs exist for the same line (returns latest)
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `)
      .eq('line_id', lineId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      // No active WO — also fetch the most recently completed WO for this line
      // so the UI can show correct completion data instead of mock WO placeholder
      try {
        const { data: completedData } = await supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(id, name, code),
            board:boards(id, name),
            line:lines(id, name),
            section:sections(id, name)
          `)
          .eq('line_id', lineId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1);

        const lastCompleted = completedData?.[0] ? transformWorkOrder(completedData[0]) : null;
        return { success: true, data: null, lastCompleted };
      } catch {
        return { success: true, data: null, lastCompleted: null };
      }
    }

    return { success: true, data: transformWorkOrder(data[0]) };
  } catch (error) {
    console.error('[WorkOrderRepo] Get active WO error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update work order
 * @param {string} id - Work order ID
 * @param {Object} data - Update data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateWorkOrder(id, data) {
  try {
    const updateFields = {};

    // Only include fields that are provided
    if (data.customerId !== undefined) updateFields.customer_id = data.customerId;
    if (data.boardId !== undefined) updateFields.board_id = data.boardId;
    if (data.lineId !== undefined) updateFields.line_id = data.lineId;
    if (data.sectionId !== undefined) updateFields.section_id = data.sectionId;
    if (data.lotSize !== undefined) updateFields.lot_size = data.lotSize;
    if (data.sideCount !== undefined) updateFields.side_count = data.sideCount;
    if (data.dueDate !== undefined) updateFields.due_date = data.dueDate;
    if (data.priority !== undefined) updateFields.priority = data.priority;
    if (data.notes !== undefined) updateFields.notes = data.notes;
    if (data.status !== undefined) updateFields.status = data.status;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(workOrder) };
  } catch (error) {
    console.error('[WorkOrderRepo] Update error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start work order (set status to active)
 * @param {string} id - Work order ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function startWorkOrder(id) {
  try {
    // First check if there's already an active WO on this line
    const { data: wo } = await supabase
      .from('work_orders')
      .select('line_id')
      .eq('id', id)
      .single();

    if (wo) {
      const { data: activeWO } = await supabase
        .from('work_orders')
        .select('id, wo_number')
        .eq('line_id', wo.line_id)
        .eq('status', 'active')
        .single();

      if (activeWO && activeWO.id !== id) {
        return {
          success: false,
          error: `Line already has active WO: ${activeWO.wo_number}`,
        };
      }
    }

    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(data) };
  } catch (error) {
    console.error('[WorkOrderRepo] Start error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete work order
 * @param {string} id - Work order ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function completeWorkOrder(id) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, code),
        board:boards(id, name),
        line:lines(id, name),
        section:sections(id, name)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(data) };
  } catch (error) {
    console.error('[WorkOrderRepo] Complete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update work order counters (good, ng, false_call, completed)
 * Uses an in-memory mutex lock per WO ID to prevent concurrent read-then-write
 * race conditions. Without serialization, two overlapping calls can read the same
 * base value and both write base+delta, losing one increment entirely.
 * @param {string} id - Work order ID
 * @param {Object} counters - Counter updates (deltas, not absolute values)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateWorkOrderCounters(id, counters) {
  // Acquire per-WO lock — serializes concurrent calls for the same WO
  const lock = acquireCounterLock(id);
  await lock.wait;

  try {
    const { goodQty, ngQty, falseCallQty, completedQty } = counters;

    // Get current values first (serialized — no other call can read between our read and write)
    const { data: current, error: fetchError } = await supabase
      .from('work_orders')
      .select('good_qty, ng_qty, false_call_qty, completed_qty, lot_size')
      .eq('id', id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Calculate new values (clamp to 0 — negative deltas from override corrections)
    const newGoodQty = Math.max(0, current.good_qty + (goodQty || 0));
    const newNgQty = Math.max(0, current.ng_qty + (ngQty || 0));
    const newFalseCallQty = Math.max(0, current.false_call_qty + (falseCallQty || 0));
    const newCompletedQty = Math.max(0, current.completed_qty + (completedQty || 0));

    const updateData = {
      good_qty: newGoodQty,
      ng_qty: newNgQty,
      false_call_qty: newFalseCallQty,
      completed_qty: newCompletedQty,
    };

    // Auto-complete if lot size reached
    if (current.lot_size > 0 && newCompletedQty >= current.lot_size) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: transformWorkOrder(data) };
  } catch (error) {
    console.error('[WorkOrderRepo] Update counters error:', error);
    return { success: false, error: error.message };
  } finally {
    lock.release();
  }
}

/**
 * Delete work order (only if draft)
 * @param {string} id - Work order ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteWorkOrder(id) {
  try {
    // Check status first
    const { data: wo, error: checkError } = await supabase
      .from('work_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (checkError) {
      return { success: false, error: checkError.message };
    }

    if (wo.status !== 'draft') {
      return { success: false, error: 'Can only delete draft work orders' };
    }

    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[WorkOrderRepo] Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get next board sequence for a work order
 * @param {string} workOrderId - Work order ID
 * @returns {Promise<{success: boolean, data?: number, error?: string}>}
 */
export async function getNextBoardSequence(workOrderId) {
  try {
    const { data, error } = await supabase
      .from('inspection_results')
      .select('board_sequence')
      .eq('work_order_id', workOrderId)
      .order('board_sequence', { ascending: false })
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    const nextSeq = data && data.length > 0 ? data[0].board_sequence + 1 : 1;
    return { success: true, data: nextSeq };
  } catch (error) {
    console.error('[WorkOrderRepo] Get next sequence error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Transform database record to camelCase API response
 * @param {Object} wo - Work order record
 * @returns {Object}
 */
function transformWorkOrder(wo) {
  if (!wo) return null;

  return {
    id: wo.id,
    woNumber: wo.wo_number,
    customerId: wo.customer_id,
    boardId: wo.board_id,
    lineId: wo.line_id,
    sectionId: wo.section_id,
    lotSize: wo.lot_size,
    sideCount: wo.side_count,
    dueDate: wo.due_date,
    completedQty: wo.completed_qty,
    goodQty: wo.good_qty,
    ngQty: wo.ng_qty,
    falseCallQty: wo.false_call_qty,
    status: wo.status,
    priority: wo.priority,
    createdBy: wo.created_by,
    createdAt: wo.created_at,
    startedAt: wo.started_at,
    completedAt: wo.completed_at,
    notes: wo.notes,
    // Joined relations
    customer: wo.customer,
    board: wo.board,
    line: wo.line,
    section: wo.section,
    createdByUser: wo.created_by_user,
    // Calculated fields
    yieldPercent: wo.completed_qty > 0
      ? ((wo.good_qty / wo.completed_qty) * 100).toFixed(1)
      : '0.0',
    progress: wo.lot_size > 0
      ? ((wo.completed_qty / wo.lot_size) * 100).toFixed(1)
      : '0.0',
  };
}

// Export as named object
export const workOrderRepo = {
  create: createWorkOrder,
  getById: getWorkOrderById,
  getAll: getWorkOrders,
  getActiveByLine: getActiveWorkOrderByLine,
  update: updateWorkOrder,
  start: startWorkOrder,
  complete: completeWorkOrder,
  updateCounters: updateWorkOrderCounters,
  delete: deleteWorkOrder,
  getNextBoardSequence,
};

export default workOrderRepo;

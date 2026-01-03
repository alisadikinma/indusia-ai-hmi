/**
 * Inspection Repository
 * Handles CRUD operations for inspection results and defects
 */

import { supabase } from '@/lib/supabaseClient';

/**
 * Create a new inspection result
 * @param {Object} data - Inspection data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createInspection(data) {
  try {
    const {
      boardId,
      batchId,
      boardTypeId,
      lineId,
      sectionId,
      customerId,
      aiResult,
      aiConfidence,
      aiModelVersion,
      operatorDecision,
      operatorId,
      plcSignalSent,
      cycleTimeMs,
      imageFullPath,
      imageThumbnailPath,
      imageDefectCropPath,
      shift,
      defects = [],
      falseCallReasonCode, // e.g., 'REFLECTION', 'ACCEPTABLE_VARIATION'
    } = data;

    // Lookup false_call_reason_id if code provided
    let falseCallReasonId = null;
    if (falseCallReasonCode) {
      const { data: reasonData } = await supabase
        .from('false_call_reasons')
        .select('id')
        .eq('code', falseCallReasonCode)
        .single();
      falseCallReasonId = reasonData?.id || null;
    }

    // Insert inspection result
    const { data: inspection, error: inspectionError } = await supabase
      .from('inspection_results')
      .insert({
        board_id: boardId,
        batch_id: batchId,
        board_type_id: boardTypeId,
        line_id: lineId,
        section_id: sectionId,
        customer_id: customerId,
        ai_result: aiResult,
        ai_confidence: aiConfidence,
        ai_model_version: aiModelVersion,
        operator_decision: operatorDecision,
        operator_id: operatorId,
        decision_timestamp: operatorDecision ? new Date().toISOString() : null,
        plc_signal_sent: plcSignalSent,
        plc_signal_timestamp: plcSignalSent ? new Date().toISOString() : null,
        cycle_time_ms: cycleTimeMs,
        image_full_path: imageFullPath,
        image_thumbnail_path: imageThumbnailPath,
        image_defect_crop_path: imageDefectCropPath,
        shift,
      })
      .select()
      .single();

    if (inspectionError) {
      console.error('[InspectionRepo] Create inspection error:', inspectionError);
      return { success: false, error: inspectionError.message };
    }

    // Insert defects if any
    if (defects.length > 0) {
      const defectRecords = defects.map(d => ({
        inspection_id: inspection.id,
        defect_type: d.defectType || d.class_name,
        defect_code: d.defectCode,
        severity: d.severity,
        confidence: d.confidence,
        bbox_x: d.bbox?.x || d.bboxX,
        bbox_y: d.bbox?.y || d.bboxY,
        bbox_width: d.bbox?.width || d.bboxWidth,
        bbox_height: d.bbox?.height || d.bboxHeight,
        component_ref: d.componentRef || d.component_ref,
        pin_number: d.pinNumber || d.pin_number,
        operator_disposition: d.operatorDisposition,
        false_call_reason_id: falseCallReasonId, // Use looked-up UUID
        false_call_notes: d.falseCallNotes,
      }));

      const { error: defectsError } = await supabase
        .from('inspection_defects')
        .insert(defectRecords);

      if (defectsError) {
        console.error('[InspectionRepo] Insert defects error:', defectsError);
        // Don't fail the whole operation, just log it
      }
    }

    return { success: true, data: inspection };

  } catch (error) {
    console.error('[InspectionRepo] Create error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inspection by ID with defects
 * @param {string} id - Inspection ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getInspectionById(id) {
  try {
    const { data: inspection, error } = await supabase
      .from('inspection_results')
      .select(`
        *,
        defects:inspection_defects(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: inspection };

  } catch (error) {
    console.error('[InspectionRepo] Get by ID error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inspections with filters
 * @param {Object} filters - Query filters
 * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
 */
export async function getInspections(filters = {}) {
  try {
    const {
      lineId,
      sectionId,
      customerId,
      aiResult,
      operatorDecision,
      dateFrom,
      dateTo,
      operatorId,
      boardId,
      limit = 50,
      offset = 0,
      orderBy = 'inspection_timestamp',
      orderDirection = 'desc',
    } = filters;

    let query = supabase
      .from('inspection_results')
      .select('*', { count: 'exact' });

    // Apply filters
    if (lineId) query = query.eq('line_id', lineId);
    if (sectionId) query = query.eq('section_id', sectionId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (aiResult) query = query.eq('ai_result', aiResult);
    if (operatorDecision) query = query.eq('operator_decision', operatorDecision);
    if (operatorId) query = query.eq('operator_id', operatorId);
    if (boardId) query = query.ilike('board_id', `%${boardId}%`);
    
    if (dateFrom) {
      query = query.gte('inspection_timestamp', dateFrom);
    }
    if (dateTo) {
      query = query.lte('inspection_timestamp', dateTo);
    }

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, count };

  } catch (error) {
    console.error('[InspectionRepo] Get inspections error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update inspection with operator decision
 * @param {string} id - Inspection ID
 * @param {Object} data - Update data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateInspectionDecision(id, data) {
  try {
    const {
      operatorDecision,
      operatorId,
      plcSignalSent,
      cycleTimeMs,
    } = data;

    const { data: inspection, error } = await supabase
      .from('inspection_results')
      .update({
        operator_decision: operatorDecision,
        operator_id: operatorId,
        decision_timestamp: new Date().toISOString(),
        plc_signal_sent: plcSignalSent,
        plc_signal_timestamp: plcSignalSent ? new Date().toISOString() : null,
        cycle_time_ms: cycleTimeMs,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: inspection };

  } catch (error) {
    console.error('[InspectionRepo] Update decision error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inspection statistics
 * @param {Object} filters - Query filters (lineId, dateFrom, dateTo)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getInspectionStats(filters = {}) {
  try {
    const { lineId, sectionId, dateFrom, dateTo, shift } = filters;

    let query = supabase
      .from('inspection_results')
      .select('ai_result, operator_decision');

    if (lineId) query = query.eq('line_id', lineId);
    if (sectionId) query = query.eq('section_id', sectionId);
    if (shift) query = query.eq('shift', shift);
    if (dateFrom) query = query.gte('inspection_timestamp', dateFrom);
    if (dateTo) query = query.lte('inspection_timestamp', dateTo);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Calculate stats
    const total = data.length;
    const aiPass = data.filter(d => d.ai_result === 'PASS').length;
    const aiFail = data.filter(d => d.ai_result === 'FAIL').length;
    const approved = data.filter(d => d.operator_decision === 'APPROVE').length;
    const rejected = data.filter(d => d.operator_decision === 'REJECT').length;
    const falseCall = data.filter(d => d.operator_decision === 'FALSE_CALL').length;

    const stats = {
      total,
      aiPass,
      aiFail,
      approved,
      rejected,
      falseCall,
      yieldPercent: total > 0 ? ((approved + aiPass) / total * 100).toFixed(2) : 0,
      falseCallRate: aiFail > 0 ? ((falseCall / aiFail) * 100).toFixed(2) : 0,
    };

    return { success: true, data: stats };

  } catch (error) {
    console.error('[InspectionRepo] Get stats error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get defect class options
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getDefectClasses() {
  try {
    const { data, error } = await supabase
      .from('defect_classes')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (error) {
    console.error('[InspectionRepo] Get defect classes error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get false call reason options
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getFalseCallReasons() {
  try {
    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (error) {
    console.error('[InspectionRepo] Get false call reasons error:', error);
    return { success: false, error: error.message };
  }
}

// Export as named object for easier imports
export const inspectionRepo = {
  create: createInspection,
  getById: getInspectionById,
  getAll: getInspections,
  updateDecision: updateInspectionDecision,
  getStats: getInspectionStats,
  getDefectClasses,
  getFalseCallReasons,
};

export default inspectionRepo;

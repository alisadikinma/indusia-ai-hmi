/**
 * Inspection Service
 * Client-side functions for inspection API calls
 */

/**
 * Save inspection result to database
 * @param {Object} data - Inspection data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function saveInspection(data) {
  try {
    const response = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to save inspection');
    }

    console.log('[InspectionService] Saved inspection:', result.data?.id);
    return { success: true, data: result.data };

  } catch (error) {
    console.error('[InspectionService] Save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update inspection decision
 * @param {string} id - Inspection ID
 * @param {Object} data - Update data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateInspectionDecision(id, data) {
  try {
    const response = await fetch(`/api/inspections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update inspection');
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('[InspectionService] Update error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inspection statistics
 * @param {Object} filters - Query filters
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getInspectionStats(filters = {}) {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const response = await fetch(`/api/inspections/stats?${params}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to get stats');
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('[InspectionService] Stats error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get defect classes
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getDefectClasses() {
  try {
    const response = await fetch('/api/inspections/defect-classes');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to get defect classes');
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('[InspectionService] Get defect classes error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get false call reasons
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getFalseCallReasons() {
  try {
    const response = await fetch('/api/inspections/false-call-reasons');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to get false call reasons');
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('[InspectionService] Get false call reasons error:', error);
    return { success: false, error: error.message };
  }
}

export const inspectionService = {
  save: saveInspection,
  updateDecision: updateInspectionDecision,
  getStats: getInspectionStats,
  getDefectClasses,
  getFalseCallReasons,
};

export default inspectionService;

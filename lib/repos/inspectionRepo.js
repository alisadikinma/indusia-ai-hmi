/**
 * Inspection Repository
 * Database operations for inspection results and sessions
 */

import { supabase } from '@/lib/supabaseClient';
import { toCamelCase, toSnakeCase } from './index';

export const inspectionRepo = {
  // =============================================
  // Sessions
  // =============================================

  /**
   * Start new inspection session
   */
  async startSession({ operatorId, lineId, boardId }) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .insert({
          operator_id: operatorId,
          line_id: lineId,
          board_id: boardId,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('startSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * End inspection session
   */
  async endSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('endSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Pause/Resume session
   */
  async updateSessionStatus(sessionId, status, pauseTimeMs = 0) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (pauseTimeMs > 0) {
        // Get current pause time and add to it
        const { data: current } = await supabase
          .from('inspection_sessions')
          .select('total_pause_time_ms')
          .eq('id', sessionId)
          .single();

        updateData.total_pause_time_ms = (current?.total_pause_time_ms || 0) + pauseTimeMs;
      }

      const { data, error } = await supabase
        .from('inspection_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('updateSessionStatus error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get active session for operator
   */
  async getActiveSession(operatorId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: data ? toCamelCase(data) : null };
    } catch (error) {
      console.error('getActiveSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .select(`
          *,
          operator:users!operator_id(id, name, email),
          line:lines!line_id(id, name),
          board:boards!board_id(id, name)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('getSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * List sessions with filters
   */
  async listSessions({ operatorId, lineId, status, limit = 20, offset = 0 }) {
    try {
      let query = supabase
        .from('inspection_sessions')
        .select(`
          *,
          operator:users!operator_id(id, name),
          line:lines!line_id(id, name)
        `, { count: 'exact' })
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (operatorId) query = query.eq('operator_id', operatorId);
      if (lineId) query = query.eq('line_id', lineId);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        success: true,
        data: (data || []).map(toCamelCase),
        total: count || 0,
      };
    } catch (error) {
      console.error('listSessions error:', error);
      return { success: false, error: error.message };
    }
  },

  // =============================================
  // Results
  // =============================================

  /**
   * Record inspection result
   */
  async recordResult({
    sessionId,
    boardId,
    lineId,
    sectionId,
    customerId,
    frameId,
    imageUrl,
    aiResult,
    aiConfidence,
    aiDefectType,
    aiDetections,
    operatorAction,
    operatorId,
    operatorNotes,
    decisionTimeMs,
    autoApproved = false,
  }) {
    try {
      const insertData = {
        session_id: sessionId,
        board_id: boardId,
        line_id: lineId,
        section_id: sectionId,
        customer_id: customerId,
        frame_id: frameId,
        image_url: imageUrl,
        ai_result: aiResult,
        ai_confidence: aiConfidence,
        ai_defect_type: aiDefectType,
        ai_detections: aiDetections,
        operator_action: operatorAction,
        operator_id: operatorId,
        operator_notes: operatorNotes,
        decision_time_ms: decisionTimeMs,
        auto_approved: autoApproved,
      };

      // Remove undefined values
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === undefined) {
          delete insertData[key];
        }
      });

      const { data, error } = await supabase
        .from('inspection_results')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('recordResult error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Link false call to override
   */
  async linkOverride(resultId, overrideId) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .update({ override_id: overrideId })
        .eq('id', resultId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('linkOverride error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get results for session
   */
  async getSessionResults(sessionId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('inspected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: (data || []).map(toCamelCase) };
    } catch (error) {
      console.error('getSessionResults error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get result by ID
   */
  async getResult(resultId) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .select(`
          *,
          operator:users!operator_id(id, name),
          board:boards!board_id(id, name),
          line:lines!line_id(id, name)
        `)
        .eq('id', resultId)
        .single();

      if (error) throw error;
      return { success: true, data: toCamelCase(data) };
    } catch (error) {
      console.error('getResult error:', error);
      return { success: false, error: error.message };
    }
  },

  // =============================================
  // Statistics
  // =============================================

  /**
   * Get stats for line (today)
   */
  async getLineStats(lineId, fromDate = null) {
    try {
      const startDate = fromDate || new Date();
      if (!fromDate) {
        startDate.setHours(0, 0, 0, 0);
      }

      const { data, error } = await supabase
        .from('inspection_results')
        .select('operator_action, auto_approved')
        .eq('line_id', lineId)
        .gte('inspected_at', startDate.toISOString());

      if (error) throw error;

      const results = data || [];
      const stats = {
        total: results.length,
        approved: results.filter(r => r.operator_action === 'approve').length,
        rejected: results.filter(r => r.operator_action === 'reject').length,
        falseCalls: results.filter(r => r.operator_action === 'false_call').length,
        autoApproved: results.filter(r => r.auto_approved).length,
      };

      stats.yieldRate = stats.total > 0
        ? ((stats.approved + stats.autoApproved) / stats.total * 100).toFixed(1)
        : '0.0';

      return { success: true, data: stats };
    } catch (error) {
      console.error('getLineStats error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get operator performance stats
   */
  async getOperatorStats(operatorId, days = 7) {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from('inspection_results')
        .select('operator_action, decision_time_ms, auto_approved, inspected_at')
        .eq('operator_id', operatorId)
        .gte('inspected_at', fromDate.toISOString());

      if (error) throw error;

      const results = data || [];
      const decisionsWithTime = results.filter(r => r.decision_time_ms != null);
      const avgDecisionTime = decisionsWithTime.length > 0
        ? Math.round(decisionsWithTime.reduce((sum, r) => sum + r.decision_time_ms, 0) / decisionsWithTime.length)
        : 0;

      return {
        success: true,
        data: {
          totalInspected: results.length,
          approved: results.filter(r => r.operator_action === 'approve').length,
          rejected: results.filter(r => r.operator_action === 'reject').length,
          falseCalls: results.filter(r => r.operator_action === 'false_call').length,
          autoApproved: results.filter(r => r.auto_approved).length,
          avgDecisionTimeMs: avgDecisionTime,
          autoApproveRate: results.length > 0
            ? (results.filter(r => r.auto_approved).length / results.length * 100).toFixed(1)
            : '0.0',
        },
      };
    } catch (error) {
      console.error('getOperatorStats error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session summary stats
   */
  async getSessionStats(sessionId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .select(`
          total_inspected,
          total_approved,
          total_rejected,
          total_false_calls,
          total_auto_approved,
          avg_decision_time_ms,
          total_pause_time_ms,
          started_at,
          ended_at
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const session = toCamelCase(data);
      const duration = session.endedAt
        ? new Date(session.endedAt) - new Date(session.startedAt)
        : Date.now() - new Date(session.startedAt);

      return {
        success: true,
        data: {
          ...session,
          durationMs: duration - (session.totalPauseTimeMs || 0),
          yieldRate: session.totalInspected > 0
            ? ((session.totalApproved + session.totalAutoApproved) / session.totalInspected * 100).toFixed(1)
            : '0.0',
        },
      };
    } catch (error) {
      console.error('getSessionStats error:', error);
      return { success: false, error: error.message };
    }
  },
};

export default inspectionRepo;

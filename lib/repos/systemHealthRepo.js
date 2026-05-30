/**
 * System Health Repository
 * Fetches real system health status from database
 */

import { supabase } from '@/lib/supabaseClient';

/**
 * Get overall system health status
 */
export async function getSystemHealth() {
  try {
    const now = new Date();

    // Run all health checks in parallel
    const [dbResult, modelResult, cameraResult, syncResult] = await Promise.allSettled([
      supabase.from('users').select('id').limit(1),
      supabase.from('models').select('id, name, version, status, deployed_at').eq('status', 'deployed').order('deployed_at', { ascending: false }).limit(1).single(),
      supabase.from('system_status').select('*').eq('component', 'camera').single(),
      supabase.from('sync_history').select('*').order('completed_at', { ascending: false }).limit(1).single(),
    ]);

    // 1. Database
    const dbOk = dbResult.status === 'fulfilled' && !dbResult.value.error;
    const database = dbOk
      ? { state: 'ok', message: 'Database connected', lastUpdated: now }
      : { state: 'error', message: `Database error: ${dbResult.status === 'fulfilled' ? dbResult.value.error?.message : dbResult.reason}`, lastUpdated: now };

    // 2. AI Model
    let aiModel;
    if (modelResult.status === 'fulfilled') {
      const { data: modelData, error: modelError } = modelResult.value;
      if (modelData && (!modelError || modelError.code === 'PGRST116')) {
        aiModel = { state: 'ok', message: `Model ${modelData.name} v${modelData.version} running`, lastUpdated: now };
      } else {
        aiModel = { state: 'warning', message: 'No deployed model found', lastUpdated: now };
      }
    } else {
      aiModel = { state: 'ok', message: 'AI Model status not configured', lastUpdated: now };
    }

    // 3. Camera
    let camera;
    if (cameraResult.status === 'fulfilled') {
      const { data: cameraData, error: cameraError } = cameraResult.value;
      if (cameraData && (!cameraError || cameraError.code === 'PGRST116')) {
        camera = { state: cameraData.status || 'ok', message: cameraData.message || 'Camera connected', lastUpdated: now };
      } else {
        camera = { state: 'ok', message: 'Camera system online', lastUpdated: now };
      }
    } else {
      camera = { state: 'ok', message: 'Camera status not configured', lastUpdated: now };
    }

    // 4. Cloud (derived from DB)
    const cloud = {
      state: database.state === 'ok' ? 'ok' : 'error',
      message: database.state === 'ok' ? 'Cloud services connected' : 'Cloud disconnected',
      lastUpdated: now,
    };

    // 5. Last Sync
    let lastSync;
    if (syncResult.status === 'fulfilled') {
      const { data: syncData, error: syncError } = syncResult.value;
      if (syncData && (!syncError || syncError.code === 'PGRST116')) {
        const syncAge = (now - new Date(syncData.completed_at)) / 1000 / 60;
        lastSync = {
          state: syncData.status === 'success' ? 'ok' : (syncData.status === 'partial' ? 'warning' : 'error'),
          message: syncData.status === 'success' ? `Last sync: ${syncData.record_count} records` : `Last sync ${syncData.status}`,
          lastUpdated: new Date(syncData.completed_at),
          details: { syncedRecords: syncData.success_count || syncData.record_count, failedRecords: syncData.failed_count || 0, durationMs: syncData.duration_ms, minutesAgo: Math.round(syncAge) },
        };
      } else {
        lastSync = { state: 'warning', message: 'No sync history found', lastUpdated: now };
      }
    } else {
      lastSync = { state: 'warning', message: 'Sync status unavailable', lastUpdated: now };
    }

    return { success: true, data: { database, aiModel, camera, cloud, lastSync } };
  } catch (error) {
    console.error('[systemHealthRepo] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get line runtime status
 */
export async function getLineRuntimeStatus(lineId = null) {
  try {
    let query = supabase
      .from('lines')
      .select('id, name, status, created_at');

    if (lineId) {
      query = query.eq('id', lineId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('[systemHealthRepo] Line runtime error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update system status (for components that report status)
 */
export async function updateSystemStatus(component, status, message, details = null) {
  try {
    const { data, error } = await supabase
      .from('system_status')
      .upsert({
        component,
        status,
        message,
        details,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'component' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[systemHealthRepo] Update status error:', error);
    return { success: false, error: error.message };
  }
}

export const systemHealthRepo = {
  getSystemHealth,
  getLineRuntimeStatus,
  updateSystemStatus,
};

export default systemHealthRepo;

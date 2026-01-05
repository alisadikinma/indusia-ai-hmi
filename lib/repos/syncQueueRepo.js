/**
 * Sync Queue Repository
 * Manages false call records pending cloud sync for AI training
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Mock storage for dev mode when Supabase not configured
const mockQueue = [];

/**
 * Add item to sync queue (called after FALSE_CALL decision)
 */
export async function addToQueue(data) {
  if (!isSupabaseConfigured) {
    const mockId = `sq-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const item = { id: mockId, ...data, status: 'pending', created_at: new Date().toISOString() }
    mockQueue.push(item)
    console.warn('[SyncQueueRepo] Supabase not configured, stored in memory:', mockId)
    return { success: true, data: item }
  }

  try {
    const {
      inspectionId,
      boardId,
      customerName,
      sectionName,
      lineName,
      defectType,
      defectCount = 1,
      localImagePath,
      localCropPath,
      recordType = 'false_call',
    } = data;

    const { data: item, error } = await supabase
      .from('sync_queue')
      .insert({
        inspection_id: inspectionId,
        board_id: boardId,
        customer_name: customerName,
        section_name: sectionName,
        line_name: lineName,
        defect_type: defectType,
        defect_count: defectCount,
        local_image_path: localImagePath,
        local_crop_path: localCropPath,
        record_type: recordType,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[SyncQueueRepo] Add to queue error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: item };
  } catch (error) {
    console.error('[SyncQueueRepo] Add to queue error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending items in queue
 */
export async function getPendingItems(limit = 100) {
  if (!isSupabaseConfigured) {
    const pending = mockQueue.filter(i => i.status === 'pending').slice(0, limit)
    return { success: true, data: pending, count: pending.length }
  }

  try {
    const { data, error, count } = await supabase
      .from('sync_queue')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, count };
  } catch (error) {
    console.error('[SyncQueueRepo] Get pending error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get queue summary for display
 */
export async function getQueueSummary() {
  if (!isSupabaseConfigured) {
    const pending = mockQueue.filter(i => i.status === 'pending').length
    const synced = mockQueue.filter(i => i.status === 'synced').length
    const failed = mockQueue.filter(i => i.status === 'failed').length
    return { success: true, data: { pendingCount: pending, syncedCount: synced, failedCount: failed, lastSyncTime: null, lastSyncStatus: 'never' } }
  }

  try {
    // Get counts by status
    const { data: pending, error: pendingError } = await supabase
      .from('sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: synced, error: syncedError } = await supabase
      .from('sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'synced');

    const { data: failed, error: failedError } = await supabase
      .from('sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Get last sync time
    const { data: lastSync } = await supabase
      .from('sync_history')
      .select('completed_at, status')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return {
      success: true,
      data: {
        pendingCount: pending?.length || 0,
        syncedCount: synced?.length || 0,
        failedCount: failed?.length || 0,
        lastSyncTime: lastSync?.completed_at || null,
        lastSyncStatus: lastSync?.status || 'never',
      },
    };
  } catch (error) {
    console.error('[SyncQueueRepo] Get summary error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get grouped queue items for display (like the UI shows)
 */
export async function getGroupedQueueItems() {
  if (!isSupabaseConfigured) {
    return { success: true, data: [] }
  }

  try {
    const { data, error } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    // Group by customer + section + board
    const grouped = {};
    data.forEach(item => {
      const key = `${item.customer_name || 'Unknown'}_${item.section_name || 'Unknown'}_${item.board_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          customerName: item.customer_name || 'Unknown',
          sectionName: item.section_name || 'Unknown',
          boardId: item.board_id,
          defectsCount: 0,
          type: item.record_type === 'false_call' ? 'False Call' : 'Override',
          status: 'ready',
          items: [],
        };
      }
      grouped[key].defectsCount += item.defect_count || 1;
      grouped[key].items.push(item);
    });

    return { success: true, data: Object.values(grouped) };
  } catch (error) {
    console.error('[SyncQueueRepo] Get grouped error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update item status
 */
export async function updateItemStatus(id, status, extra = {}) {
  if (!isSupabaseConfigured) {
    const item = mockQueue.find(i => i.id === id)
    if (item) { item.status = status; Object.assign(item, extra) }
    return { success: true, data: item }
  }

  try {
    const updateData = {
      status,
      ...extra,
    };

    if (status === 'synced') {
      updateData.synced_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('sync_queue')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[SyncQueueRepo] Update status error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark multiple items as syncing
 */
export async function markAsSyncing(ids) {
  if (!isSupabaseConfigured) {
    ids.forEach(id => { const item = mockQueue.find(i => i.id === id); if (item) item.status = 'syncing' })
    return { success: true, data: [] }
  }

  try {
    const { data, error } = await supabase
      .from('sync_queue')
      .update({ status: 'syncing' })
      .in('id', ids)
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[SyncQueueRepo] Mark as syncing error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark items as synced with cloud paths
 */
export async function markAsSynced(id, cloudPaths, syncedBy) {
  if (!isSupabaseConfigured) {
    const item = mockQueue.find(i => i.id === id)
    if (item) { item.status = 'synced'; item.synced_at = new Date().toISOString(); item.cloud_image_path = cloudPaths?.imagePath }
    return { success: true, data: item }
  }

  try {
    const { data, error } = await supabase
      .from('sync_queue')
      .update({
        status: 'synced',
        synced_at: new Date().toISOString(),
        synced_by: syncedBy,
        cloud_image_path: cloudPaths.imagePath,
        cloud_crop_path: cloudPaths.cropPath,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[SyncQueueRepo] Mark as synced error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark item as failed
 */
export async function markAsFailed(id, errorMessage) {
  if (!isSupabaseConfigured) {
    const item = mockQueue.find(i => i.id === id)
    if (item) { item.status = 'failed'; item.sync_error = errorMessage }
    return { success: true, data: item }
  }

  try {
    const { data, error } = await supabase
      .from('sync_queue')
      .update({
        status: 'failed',
        sync_error: errorMessage,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[SyncQueueRepo] Mark as failed error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add sync history record
 */
export async function addSyncHistory(data) {
  if (!isSupabaseConfigured) {
    console.warn('[SyncQueueRepo] Supabase not configured, skipping history')
    return { success: true, data: { id: 'mock-history', ...data } }
  }

  try {
    const { data: history, error } = await supabase
      .from('sync_history')
      .insert({
        record_count: data.recordCount,
        success_count: data.successCount,
        failed_count: data.failedCount,
        status: data.status,
        error_message: data.errorMessage,
        started_at: data.startedAt,
        completed_at: data.completedAt,
        duration_ms: data.durationMs,
        triggered_by: data.triggeredBy,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: history };
  } catch (error) {
    console.error('[SyncQueueRepo] Add history error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit = 10) {
  if (!isSupabaseConfigured) {
    return { success: true, data: [] }
  }

  try {
    const { data, error } = await supabase
      .from('sync_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[SyncQueueRepo] Get history error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear synced items (cleanup)
 */
export async function clearSyncedItems(olderThanDays = 30) {
  if (!isSupabaseConfigured) {
    return { success: true }
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabase
      .from('sync_queue')
      .delete()
      .eq('status', 'synced')
      .lt('synced_at', cutoffDate.toISOString());

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[SyncQueueRepo] Clear synced error:', error);
    return { success: false, error: error.message };
  }
}

export const syncQueueRepo = {
  addToQueue,
  getPendingItems,
  getQueueSummary,
  getGroupedQueueItems,
  updateItemStatus,
  markAsSyncing,
  markAsSynced,
  markAsFailed,
  addSyncHistory,
  getSyncHistory,
  clearSyncedItems,
};

export default syncQueueRepo;

/**
 * Shared formatters for sync-queue API endpoints.
 * Used by /api/sync-queue/records, /api/sync-queue/session-records, etc.
 */

export const ALLOWED_TABLES = [
  'inspection_results',
  'inspection_defects',
  'overrides',
  'inspection_stats',
  'work_orders'
]

// Per-table record formatters — project only display-relevant fields
export const formatRecord = {
  inspection_results: (r) => ({
    id: r.id,
    summary: r.board_id || '-',
    col1: r.wo_number || '-',
    col2: r.ai_result || '-',
    syncStatus: r.sync_status || 'pending',
    syncedAt: r.synced_at || null,
    syncError: r.sync_error || null,
    overrideStatus: null,
    createdAt: r.created_at
  }),
  overrides: (r) => ({
    id: r.id,
    summary: r.board_id || '-',
    col1: r.defect_type || '-',
    col2: r.operator_name || '-',
    overrideStatus: r.status, // approved / rejected / pending
    syncStatus: r.sync_status || 'pending',
    syncedAt: r.synced_at || null,
    syncError: r.sync_error || null,
    createdAt: r.created_at
  }),
  inspection_defects: (r) => ({
    id: r.id,
    summary: r.defect_class || '-',
    col1: r.severity || '-',
    col2: r.inspection_result_id ? r.inspection_result_id.substring(0, 8) : '-',
    syncStatus: r.sync_status || 'pending',
    syncedAt: r.synced_at || null,
    syncError: r.sync_error || null,
    overrideStatus: null,
    createdAt: r.created_at
  }),
  inspection_stats: (r) => ({
    id: r.id,
    summary: r.line_id || '-',
    col1: r.shift_date || '-',
    col2: r.total_inspected != null ? String(r.total_inspected) : '0',
    syncStatus: r.sync_status || 'pending',
    syncedAt: r.synced_at || null,
    syncError: r.sync_error || null,
    overrideStatus: null,
    createdAt: r.created_at
  }),
  work_orders: (r) => ({
    id: r.id,
    summary: r.wo_number || '-',
    col1: `Lot: ${r.lot_size || 0}`,
    col2: `Good: ${r.good_qty || 0} / NG: ${r.ng_qty || 0}`,
    woStatus: r.status,
    syncStatus: r.sync_status || 'pending',
    syncedAt: r.synced_at || null,
    syncError: r.sync_error || null,
    overrideStatus: null,
    createdAt: r.created_at
  })
}

// Column headers per table (3 text columns + status badges handled separately)
export const tableColumns = {
  inspection_results: ['Board ID', 'WO Number', 'AI Result'],
  overrides: ['Board ID', 'Type', 'Operator'],
  inspection_defects: ['Class', 'Severity', 'Result ID'],
  inspection_stats: ['Line', 'Shift Date', 'Total'],
  work_orders: ['WO Number', 'Lot', 'Counters']
}

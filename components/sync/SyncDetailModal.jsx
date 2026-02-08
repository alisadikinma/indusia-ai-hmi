'use client';

import { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, ExternalLink, Image, Loader2, CloudOff, CheckCircle, AlertTriangle, Cloud } from 'lucide-react';

/**
 * Individual session record row (synced or failed)
 */
function SessionRecordRow({ record, table, columns }) {
  const statusColors = {
    synced: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400'
  };

  const overrideStatusColors = {
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400'
  };

  return (
    <div className="px-2 py-1.5 bg-indusia-surface rounded border border-indusia-border/50 text-[11px]">
      <div className="flex items-center gap-2">
        {/* Primary column */}
        <span className="flex-1 min-w-0 truncate font-mono text-indusia-text">
          {record.summary}
        </span>
        {/* Col1 */}
        <span className="w-20 text-center text-indusia-textMuted truncate flex-shrink-0">
          {record.col1}
        </span>
        {/* Col2 */}
        <span className="w-20 text-center text-indusia-textMuted truncate flex-shrink-0">
          {record.col2}
        </span>
        {/* Override status badge */}
        {table === 'overrides' && record.overrideStatus && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
            overrideStatusColors[record.overrideStatus] || 'bg-gray-500/20 text-gray-400'
          }`}>
            {record.overrideStatus}
          </span>
        )}
        {/* Sync status */}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium w-14 text-center flex-shrink-0 ${
          statusColors[record.syncStatus] || statusColors.pending
        }`}>
          {record.syncStatus}
        </span>
        {/* Synced time */}
        {record.syncedAt && (
          <span className="text-[10px] text-indusia-textMuted w-14 text-right flex-shrink-0">
            {new Date(record.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
      {/* Sync error for failed records */}
      {record.syncError && (
        <p className="mt-1 text-[10px] text-red-400 truncate pl-1">
          {record.syncError}
        </p>
      )}
    </div>
  );
}

/**
 * Cloud comparison result display
 */
function CompareResult({ result, t }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
        <CloudOff className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        <span className="text-xs text-yellow-400">{t('sync.cloudCompareError')}</span>
      </div>
    );
  }

  if (result.allVerified) {
    return (
      <div className="mt-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
        <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        <span className="text-xs text-green-400">
          {t('sync.allRecordsVerified')} ({result.matchedCount}/{result.localCount})
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        <span className="text-xs text-yellow-400">
          {result.matchedCount}/{result.localCount} {t('sync.cloudVerified')}
          {' — '}
          {result.missingTotal} {t('sync.cloudMissing').toLowerCase()}
        </span>
      </div>
      {result.missingInCloud?.length > 0 && (
        <div className="mt-1 pl-5">
          {result.missingInCloud.slice(0, 5).map((id) => (
            <p key={id} className="text-[10px] text-yellow-400/70 font-mono truncate">{id}</p>
          ))}
          {result.missingTotal > 5 && (
            <p className="text-[10px] text-yellow-400/50">+{result.missingTotal - 5} more...</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Expandable table detail section within the Records by Table area
 */
function ExpandableTableRow({ table, detail, session, getTableDisplayName, t }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('synced');
  const [records, setRecords] = useState({});      // keyed by status
  const [columns, setColumns] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);

  const tableName = getTableDisplayName(table);
  const total = (detail.success || 0) + (detail.failed || 0);
  const successPercent = total > 0 ? Math.round((detail.success / total) * 100) : 0;

  const loadRecords = useCallback(async (status) => {
    const cacheKey = status;
    if (records[cacheKey]) {
      setStatusFilter(status);
      return;
    }

    setLoadingRecords(true);
    setStatusFilter(status);

    try {
      const params = new URLSearchParams({
        start: session.startedAtRaw,
        end: session.completedAtRaw,
        table,
        status,
        limit: '20'
      });
      const res = await fetch(`/api/sync-queue/session-records?${params}`);
      const result = await res.json();
      if (result.success) {
        setRecords(prev => ({ ...prev, [cacheKey]: { data: result.data, isSessionSpecific: result.isSessionSpecific } }));
        if (result.columns) setColumns(result.columns);
      }
    } catch (err) {
      console.error(`[SyncDetailModal] Load records error for ${table}:`, err);
    } finally {
      setLoadingRecords(false);
    }
  }, [records, session, table]);

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
      if (!records.synced) {
        loadRecords('synced');
      }
    } else {
      setIsExpanded(false);
    }
  }, [isExpanded, records, loadRecords]);

  const handleCompare = useCallback(async () => {
    if (comparing || (detail.success || 0) === 0) return;
    setComparing(true);
    try {
      const params = new URLSearchParams({
        start: session.startedAtRaw,
        end: session.completedAtRaw,
        table
      });
      const res = await fetch(`/api/sync-queue/compare?${params}`);
      const result = await res.json();
      if (result.success) {
        setCompareResult(result.data);
      } else {
        setCompareResult({ error: result.error, offline: result.offline });
      }
    } catch (err) {
      setCompareResult({ error: err.message, offline: true });
    } finally {
      setComparing(false);
    }
  }, [comparing, detail, session, table]);

  const currentRecords = records[statusFilter];

  return (
    <div className="bg-indusia-bg rounded-lg overflow-hidden">
      {/* Header row - clickable */}
      <button
        onClick={handleToggle}
        className="w-full px-3 py-2.5 hover:bg-indusia-border/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-indusia-textMuted" />
              : <ChevronRight className="w-3.5 h-3.5 text-indusia-textMuted" />
            }
            <span className="text-sm font-medium text-indusia-text">{tableName}</span>
          </div>
          <span className="text-xs text-indusia-textMuted">
            {total} {t('common.records')}
          </span>
        </div>
        <div className="flex items-center gap-4 pl-5">
          <div className="flex-1 h-1.5 bg-indusia-border rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${successPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-500 font-medium">
              ✓ {detail.success || 0}
            </span>
            {detail.failed > 0 && (
              <span className="text-red-500 font-medium">
                ✗ {detail.failed}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-indusia-border/50">
          {/* Controls: status filter pills + compare button */}
          <div className="flex items-center justify-between mt-2.5 mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => loadRecords('synced')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === 'synced'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-indusia-surface text-indusia-textMuted hover:text-indusia-text'
                }`}
              >
                {t('sync.synced')} ({detail.success || 0})
              </button>
              <button
                onClick={() => loadRecords('failed')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === 'failed'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-indusia-surface text-indusia-textMuted hover:text-indusia-text'
                }`}
              >
                {t('sync.failed')} ({detail.failed || 0})
              </button>
            </div>

            <button
              onClick={handleCompare}
              disabled={comparing || (detail.success || 0) === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-indusia-surface text-indusia-primary hover:bg-indusia-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {comparing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
              {comparing ? t('sync.comparing') : t('sync.compareCloud')}
            </button>
          </div>

          {/* Not session-specific note for failed records */}
          {statusFilter === 'failed' && currentRecords && !currentRecords.isSessionSpecific && (
            <p className="text-[10px] text-yellow-400/70 mb-2 px-1">
              {t('sync.failedRecordsNote')}
            </p>
          )}

          {/* Column headers */}
          {columns && currentRecords?.data?.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-indusia-textMuted font-medium">
              <span className="flex-1">{columns[0]}</span>
              <span className="w-20 text-center">{columns[1]}</span>
              <span className="w-20 text-center">{columns[2]}</span>
              <span className="w-14 text-center">{t('common.status')}</span>
              <span className="w-14 text-center">{t('sync.syncTime')}</span>
            </div>
          )}

          {/* Records list */}
          {loadingRecords ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-indusia-primary" />
              <span className="ml-2 text-xs text-indusia-textMuted">Loading...</span>
            </div>
          ) : currentRecords?.data?.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {currentRecords.data.map((record) => (
                <SessionRecordRow
                  key={record.id}
                  record={record}
                  table={table}
                  columns={columns}
                />
              ))}
              {currentRecords.data.length >= 20 && (
                <p className="text-[10px] text-indusia-textMuted text-center py-1">
                  {t('sync.showingNofTotal', { shown: currentRecords.data.length, total: statusFilter === 'synced' ? detail.success : detail.failed })}
                </p>
              )}
            </div>
          ) : currentRecords ? (
            <p className="text-xs text-indusia-textMuted text-center py-3">
              {statusFilter === 'synced' ? t('sync.noSyncedRecords') : t('sync.noFailedRecords')}
            </p>
          ) : null}

          {/* Cloud comparison result */}
          <CompareResult result={compareResult} t={t} />
        </div>
      )}
    </div>
  );
}

/**
 * SyncDetailModal - Shows detailed sync session information with expandable
 * per-table record views and cloud comparison capability.
 */
export default function SyncDetailModal({ session, uploadedImages = [], loadingImages, onClose, getTableDisplayName, t }) {
  if (!session) return null;

  const hasImages = uploadedImages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full mx-4 max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-indusia-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-indusia-text">{t('sync.syncDetails')}</h3>
          <button
            onClick={onClose}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className={`p-5 overflow-y-auto flex-1 ${
          hasImages ? 'grid grid-cols-5 gap-5' : ''
        }`}>
          {/* Left Column: Sync Details */}
          <div className={`space-y-4 ${hasImages ? 'col-span-3' : ''}`}>
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                session.status === 'completed' || session.status === 'success' ? 'bg-indusia-pass' :
                session.status === 'completed_with_errors' ? 'bg-yellow-500' : 'bg-indusia-fail'
              }`} />
              <span className={`text-sm font-medium ${
                session.status === 'completed' || session.status === 'success' ? 'text-indusia-pass' :
                session.status === 'completed_with_errors' ? 'text-yellow-400' : 'text-indusia-fail'
              }`}>
                {session.status === 'completed' || session.status === 'success'
                  ? t('sync.completedSuccessfully')
                  : session.status === 'completed_with_errors'
                    ? t('sync.completedWithErrors')
                    : session.status}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indusia-bg rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indusia-text">{session.recordCount}</p>
                <p className="text-xs text-indusia-textMuted">{t('sync.total')}</p>
              </div>
              <div className="bg-indusia-bg rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-500">{session.successCount}</p>
                <p className="text-xs text-indusia-textMuted">{t('sync.success')}</p>
              </div>
              <div className="bg-indusia-bg rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{session.failedCount}</p>
                <p className="text-xs text-indusia-textMuted">{t('sync.failed')}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-indusia-border">
                <span className="text-indusia-textMuted">{t('sync.started')}</span>
                <span className="text-indusia-text">{session.timestamp}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-indusia-border">
                <span className="text-indusia-textMuted">{t('sync.completed')}</span>
                <span className="text-indusia-text">{session.completedAt}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-indusia-border">
                <span className="text-indusia-textMuted">{t('sync.triggeredBy')}</span>
                <span className="text-indusia-text capitalize">
                  {session.triggeredBy === 'manual' ? t('sync.manual') : t('sync.auto')}
                </span>
              </div>
            </div>

            {/* Per-Table Breakdown - Enhanced with expandable rows */}
            {session.tableDetails && Object.keys(session.tableDetails).length > 0 ? (
              <div>
                <p className="text-sm font-medium text-indusia-textMuted mb-3">{t('sync.recordsByTable')}</p>
                <div className="space-y-2">
                  {Object.entries(session.tableDetails).map(([table, detail]) => (
                    <ExpandableTableRow
                      key={table}
                      table={table}
                      detail={detail}
                      session={session}
                      getTableDisplayName={getTableDisplayName}
                      t={t}
                    />
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-indusia-border flex items-center justify-between text-xs">
                  <span className="text-indusia-textMuted">{t('sync.totalTables')}:</span>
                  <span className="text-indusia-text font-medium">
                    {Object.keys(session.tableDetails).length}
                  </span>
                </div>
              </div>
            ) : session.tables && session.tables.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-indusia-textMuted mb-2">{t('sync.tablesSynced')}</p>
                <div className="flex flex-wrap gap-2">
                  {session.tables.map((table, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-indusia-bg rounded text-xs text-indusia-text"
                    >
                      {getTableDisplayName(table)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Error Message */}
            {session.errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs font-medium text-red-400 mb-1">{t('sync.errorMessage')}</p>
                <p className="text-sm text-red-300">{session.errorMessage}</p>
              </div>
            )}
          </div>

          {/* Right Column: Uploaded Images */}
          {hasImages && (
            <div className="col-span-2 border-l border-indusia-border pl-5">
              <div className="flex items-center gap-2 mb-3">
                <Image className="w-4 h-4 text-indusia-primary" />
                <span className="text-sm font-medium text-indusia-text">{t('sync.uploadedImages')}</span>
                <span className="text-xs text-indusia-textMuted">({uploadedImages.length})</span>
              </div>
              <p className="text-xs text-indusia-textMuted mb-3">
                {t('sync.recentlySyncedImages')}
              </p>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {uploadedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="bg-indusia-bg rounded-lg p-2.5"
                  >
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 bg-indusia-border rounded overflow-hidden flex-shrink-0">
                        <img
                          src={img.url}
                          alt={img.boardId}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/images/placeholder.png'; }}
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-indusia-text truncate">
                          {img.boardId}
                        </p>
                        <p className="text-xs text-indusia-textMuted mt-0.5">
                          {t('sync.side')}: <span className="uppercase text-indusia-primary">{img.side}</span>
                        </p>
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indusia-primary hover:underline mt-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t('sync.viewFullImage')}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-indusia-border flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-indusia-bg text-indusia-text rounded-lg font-medium hover:bg-indusia-border transition-colors"
          >
            {t('buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

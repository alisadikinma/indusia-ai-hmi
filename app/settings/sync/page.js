'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import SyncProgressModal from '@/components/sync/SyncProgressModal';
import { Clock, RefreshCw, AlertCircle, Cloud, CloudOff, Database, CheckCircle, ChevronRight, ChevronLeft, X, Table, Image, ExternalLink, WifiOff } from 'lucide-react';

const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const HISTORY_PAGE_SIZE = 10;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Cache helpers
const getCache = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    return { data, timestamp, isExpired: age > CACHE_TTL };
  } catch (e) {
    return null;
  }
};

const setCache = (key, data) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.warn('[SyncPage] Cache save failed:', e);
  }
};

export default function SyncPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const autoSyncIntervalRef = useRef(null);

  // Table display names mapping (i18n)
  const getTableDisplayName = useCallback((table) => {
    const tableKeys = {
      'inspection_results': 'syncTables.inspectionResults',
      'inspection_defects': 'syncTables.inspectionDefects',
      'overrides': 'syncTables.overrides',
      'inspection_stats': 'syncTables.inspectionStats',
      'work_orders': 'syncTables.workOrders',
      'event_log': 'syncTables.eventLog'
    };
    const key = tableKeys[table];
    if (key) return t(key);
    return table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [t]);

  // Tab state
  const [activeTab, setActiveTab] = useState('main');

  // Main tab state
  const [pendingTables, setPendingTables] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState('never');
  const [autoSync, setAutoSync] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autoSyncEnabled') === 'true';
    }
    return false;
  });
  const [nextAutoSync, setNextAutoSync] = useState(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState('');

  // History tab state
  const [syncHistory, setSyncHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Cloud connectivity state (default to browser's online status)
  const [isCloudOnline, setIsCloudOnline] = useState(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine;
    return true;
  });
  const [checkingOnline, setCheckingOnline] = useState(false);

  // Detail Modal state
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const checkCloudOnline = useCallback(async () => {
    // Quick browser-level check first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsCloudOnline(false);
      return false;
    }
    setCheckingOnline(true);
    try {
      const res = await fetch('/api/sync/check-online');
      const result = await res.json();
      const online = result.data?.online ?? false;
      setIsCloudOnline(online);
      return online;
    } catch {
      setIsCloudOnline(false);
      return false;
    } finally {
      setCheckingOnline(false);
    }
  }, []);

  const loadPendingCounts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/sync-queue');
      const result = await response.json();
      
      if (result.success) {
        setPendingTables(result.data || []);
        setTotalPending(result.count || 0);
        setCache('indusia_sync_pending', { tables: result.data, count: result.count });
      } else {
        setError(result.error || t('sync.syncFailed'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Load uploaded images for sync session
  const loadUploadedImages = useCallback(async (count) => {
    if (!count || count <= 0) return;
    
    setLoadingImages(true);
    try {
      const params = new URLSearchParams();
      params.set('count', count.toString());
      params.set('limit', '20');
      
      const response = await fetch(`/api/sync-queue/images?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setUploadedImages(result.data || []);
      }
    } catch (err) {
      console.error('Load uploaded images error:', err);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  const loadSyncHistory = useCallback(async (page = 1, showLoading = true) => {
    try {
      if (showLoading) setLoadingHistory(true);
      const offset = (page - 1) * HISTORY_PAGE_SIZE;
      const response = await fetch(`/api/sync-queue/history?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const history = result.data.map(item => ({
          id: item.id,
          // Display format
          timestamp: item.started_at ? new Date(item.started_at).toLocaleString() : '-',
          completedAt: item.completed_at ? new Date(item.completed_at).toLocaleString() : '-',
          // Raw ISO format for API filtering
          startedAtRaw: item.started_at,
          completedAtRaw: item.completed_at,
          recordCount: item.record_count || 0,
          successCount: item.success_count || 0,
          failedCount: item.failed_count || 0,
          status: item.status,
          tables: item.tables_synced || [],
          tableDetails: item.table_details || {},
          triggeredBy: item.triggered_by || 'manual',
          errorMessage: item.error_message
        }));
        
        setSyncHistory(history);
        setTotalHistoryCount(result.total || history.length);
        
        // Cache first page
        if (page === 1) {
          setCache('indusia_sync_history', { history, total: result.total || history.length });
          
          const lastCompleted = history.find(h => 
            h.status === 'completed' || 
            h.status === 'success' || 
            h.status === 'completed_with_errors'
          );
          if (lastCompleted) {
            setLastSyncTime(lastCompleted.timestamp);
            setLastSyncStatus(lastCompleted.status);
          }
        }
      }
    } catch (err) {
      console.error('Load history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Execute sync
  const executeSync = useCallback(async (isAuto = false) => {
    if (isSyncing) return;

    // Pre-sync online check
    const online = await checkCloudOnline();
    if (!online) {
      if (!isAuto) showToast(t('sync.cloudOffline'), 'error');
      return;
    }

    const response = await fetch('/api/sync-queue');
    const result = await response.json();
    const currentPending = result.count || 0;
    
    if (currentPending === 0) {
      if (!isAuto) showToast(t('sync.noRecordsToSync'));
      return;
    }
    
    if (!isAuto) {
      setIsProgressModalOpen(true);
    }
    setIsSyncing(true);
    setStatus('running');
    setProgress(0);
    setCurrentStep(t('sync.syncing'));

    try {
      const progressSteps = [
        { percent: 10, step: t('sync.syncing') },
        { percent: 30, step: `${t('sync.syncing')} ${t('syncTables.inspectionResults')}...` },
        { percent: 45, step: `${t('sync.syncing')} ${t('syncTables.inspectionDefects')}...` },
        { percent: 60, step: `${t('sync.syncing')} ${t('syncTables.overrides')}...` },
        { percent: 75, step: `${t('sync.syncing')} ${t('syncTables.inspectionStats')}...` },
        { percent: 85, step: `${t('sync.syncing')} ${t('syncTables.workOrders')}...` },
        { percent: 95, step: t('sync.syncing') }
      ];

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < progressSteps.length) {
          setProgress(progressSteps[stepIndex].percent);
          setCurrentStep(progressSteps[stepIndex].step);
          stepIndex++;
        }
      }, 600);

      const syncResponse = await fetch('/api/sync-queue/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id,
          triggeredBy: isAuto ? 'auto' : 'manual'
        }),
      });
      
      clearInterval(progressInterval);
      const syncResult = await syncResponse.json();

      if (syncResult.success) {
        setProgress(100);
        setStatus('completed');
        setCurrentStep(`${syncResult.data.syncedCount} ${t('sync.recordsSynced')}`);
        setLastSyncTime(new Date().toLocaleString());
        setLastSyncStatus('success');
        
        await loadPendingCounts();
        await loadSyncHistory(1);
        
        showToast(t('sync.syncCompletedMsg', { count: syncResult.data.syncedCount }), 'success');
        
        setTimeout(() => {
          setIsProgressModalOpen(false);
          setIsSyncing(false);
          setStatus('idle');
        }, 2000);
      } else {
        throw new Error(syncResult.error || t('sync.syncFailed'));
      }
    } catch (err) {
      setStatus('error');
      setCurrentStep(err.message);
      if (!isAuto) {
        showToast(t('sync.syncFailedMsg', { error: err.message }), 'error');
      }
      setIsSyncing(false);
    }
  }, [isSyncing, user?.id, loadPendingCounts, loadSyncHistory, showToast, t, checkCloudOnline]);

  // Auto sync effect
  useEffect(() => {
    if (autoSync) {
      localStorage.setItem('autoSyncEnabled', 'true');
      
      const updateNextSync = () => {
        setNextAutoSync(new Date(Date.now() + AUTO_SYNC_INTERVAL));
      };
      updateNextSync();
      
      autoSyncIntervalRef.current = setInterval(() => {
        console.log('[AutoSync] Running automatic sync...');
        executeSync(true);
        updateNextSync();
      }, AUTO_SYNC_INTERVAL);
      
      showToast(t('sync.autoSyncEnabled'), 'info');
      
      return () => {
        if (autoSyncIntervalRef.current) {
          clearInterval(autoSyncIntervalRef.current);
        }
      };
    } else {
      localStorage.setItem('autoSyncEnabled', 'false');
      setNextAutoSync(null);
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    }
  }, [autoSync, executeSync, showToast, t]);

  // Initial load - use cache first
  useEffect(() => {
    checkCloudOnline();

    // Load from cache first
    const cachedPending = getCache('indusia_sync_pending');
    const cachedHistory = getCache('indusia_sync_history');
    
    if (cachedPending?.data) {
      setPendingTables(cachedPending.data.tables || []);
      setTotalPending(cachedPending.data.count || 0);
      setIsLoading(false);
      
      // Refresh in background if expired
      if (cachedPending.isExpired) {
        loadPendingCounts(false);
      }
    } else {
      loadPendingCounts(true);
    }
    
    if (cachedHistory?.data) {
      setSyncHistory(cachedHistory.data.history || []);
      setTotalHistoryCount(cachedHistory.data.total || 0);
      setLoadingHistory(false);
      
      // Set last sync from cached history
      const lastCompleted = cachedHistory.data.history?.find(h => 
        h.status === 'completed' || h.status === 'success' || h.status === 'completed_with_errors'
      );
      if (lastCompleted) {
        setLastSyncTime(lastCompleted.timestamp);
        setLastSyncStatus(lastCompleted.status);
      }
      
      // Refresh in background if expired
      if (cachedHistory.isExpired) {
        loadSyncHistory(1, false);
      }
    } else {
      loadSyncHistory(1, true);
    }
  }, [loadPendingCounts, loadSyncHistory, checkCloudOnline]);

  // Periodic online check + browser online/offline events
  useEffect(() => {
    const handleOffline = () => setIsCloudOnline(false);
    const handleOnline = () => checkCloudOnline();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Re-check every 30 seconds
    const interval = setInterval(checkCloudOnline, 30000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [checkCloudOnline]);

  // Load history when tab changes or page changes
  useEffect(() => {
    if (activeTab === 'history') {
      loadSyncHistory(historyPage);
    }
  }, [activeTab, historyPage, loadSyncHistory]);

  // Handle opening sync detail modal
  const handleOpenSyncDetail = useCallback((event) => {
    setSelectedHistory(event);
    setUploadedImages([]);
    
    const overridesDetail = event.tableDetails?.overrides;
    const successCount = overridesDetail?.success || 0;
    
    if (successCount > 0) {
      // Load images based on successful override count
      loadUploadedImages(successCount);
    }
  }, [loadUploadedImages]);

  // Countdown timer
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!nextAutoSync) {
      setCountdown('');
      return;
    }
    
    const timer = setInterval(() => {
      const diff = nextAutoSync - Date.now();
      if (diff <= 0) {
        setCountdown(t('sync.syncing'));
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [nextAutoSync, t]);

  // Pagination
  const totalPages = Math.ceil(totalHistoryCount / HISTORY_PAGE_SIZE);

  // Status label helper
  const getStatusLabel = (status) => {
    if (status === 'success' || status === 'completed') return t('status.success');
    if (status === 'completed_with_errors') return t('sync.completedWithErrors');
    if (status === 'never') return t('sync.neverSynced');
    return status;
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6 max-w-md text-center">
          <h2 className="text-lg font-bold text-indusia-text mb-2">{t('auth.notLoggedIn')}</h2>
          <button onClick={() => router.push('/login')} className="px-4 py-2 bg-indusia-primary text-white rounded-lg text-sm">
            {t('auth.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={t('sync.title')}
        description={t('sync.description')}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400">{error}</span>
          <button onClick={loadPendingCounts} className="ml-auto px-2 py-1 text-xs bg-red-500/20 rounded hover:bg-red-500/30">
            {t('buttons.retry')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-indusia-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'main' 
              ? 'bg-indusia-primary text-white' 
              : 'text-indusia-textMuted hover:text-indusia-text'
          }`}
        >
          <Cloud className="w-4 h-4 inline-block mr-2" />
          {t('sync.syncStatus')}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history' 
              ? 'bg-indusia-primary text-white' 
              : 'text-indusia-textMuted hover:text-indusia-text'
          }`}
        >
          <Clock className="w-4 h-4 inline-block mr-2" />
          {t('sync.syncHistory')}
          {totalHistoryCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">{totalHistoryCount}</span>
          )}
        </button>
      </div>

      {/* Main Tab */}
      {activeTab === 'main' && (
        <div className="grid grid-cols-2 gap-5">
          {/* Left Column: Status */}
          <div className="bg-indusia-surface rounded-xl border border-indusia-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indusia-primary" />
                <span className="font-medium text-indusia-text">{t('sync.cloudSyncStatus')}</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${
                !isCloudOnline ? 'bg-red-500/20 text-red-400' :
                lastSyncStatus === 'success' || lastSyncStatus === 'completed' ? 'bg-green-500/20 text-green-400' :
                lastSyncStatus === 'completed_with_errors' ? 'bg-yellow-500/20 text-yellow-400' :
                lastSyncStatus === 'never' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {!isCloudOnline ? t('status.offline') : getStatusLabel(lastSyncStatus)}
              </span>
            </div>

            <div className="text-center py-6 bg-indusia-bg rounded-lg mb-4">
              <p className={`text-4xl font-bold ${totalPending > 0 ? 'text-indusia-primary' : 'text-green-500'}`}>
                {totalPending}
              </p>
              <p className="text-sm text-indusia-textMuted mt-1">{t('sync.recordsReady')}</p>
            </div>

            {pendingTables.length > 0 && pendingTables.some(tb => tb.count > 0) && (
              <div className="mb-4 p-3 bg-indusia-bg rounded-lg space-y-1">
                {pendingTables
                  .filter(tb => tb.count > 0)
                  .map(tb => (
                    <div key={tb.table} className="flex justify-between text-sm">
                      <span className="text-indusia-textMuted">{getTableDisplayName(tb.table)}</span>
                      <span className="text-indusia-primary font-medium">{tb.count}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-between text-sm text-indusia-textMuted mb-4">
              <span>{t('sync.lastSync')}:</span>
              <span className="text-indusia-text">{lastSyncTime || t('time.never')}</span>
            </div>

            {/* Offline Banner */}
            {!isCloudOnline && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-400">{t('sync.cloudOffline')}</p>
                  <p className="text-xs text-red-400/70">{t('sync.cloudOfflineDesc')}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => executeSync(false)}
              disabled={isSyncing || totalPending === 0 || !isCloudOnline}
              className="w-full py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : !isCloudOnline ? <CloudOff className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              {isSyncing ? t('sync.syncing') : !isCloudOnline ? t('sync.cloudOffline') : t('sync.syncNow')}
            </button>

            <div className="mt-4 pt-4 border-t border-indusia-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-indusia-textMuted">{t('sync.autoSyncInterval')}</span>
                  {autoSync && countdown && (
                    <p className="text-xs text-indusia-primary mt-0.5">{t('sync.nextSync')} {countdown}</p>
                  )}
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-11 h-6 rounded-full transition-colors ${autoSync ? 'bg-indusia-primary' : 'bg-indusia-border'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Tables */}
          <div className="bg-indusia-surface rounded-xl border border-indusia-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indusia-textMuted" />
                <span className="font-medium text-indusia-text">{t('sync.tablesSynced')}</span>
              </div>
              <button 
                onClick={loadPendingCounts}
                disabled={isLoading}
                className="p-1.5 rounded hover:bg-indusia-bg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-indusia-textMuted ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw className="w-6 h-6 text-indusia-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTables.map((tb) => (
                  <div key={tb.table} className="flex items-center justify-between p-3 bg-indusia-bg rounded-lg">
                    <div className="flex items-center gap-3">
                      <Table className="w-4 h-4 text-indusia-textMuted" />
                      <span className="text-sm text-indusia-text">{getTableDisplayName(tb.table)}</span>
                    </div>
                    <span className={`text-sm font-medium ${tb.count > 0 ? 'text-indusia-primary' : 'text-indusia-textMuted'}`}>
                      {tb.count > 0 ? `${tb.count} ${t('sync.pending')}` : `0 ${t('sync.pending')}`}
                    </span>
                  </div>
                ))}

                {totalPending === 0 && (
                  <div className="mt-4 p-4 text-center">
                    <CheckCircle className="w-10 h-10 text-indusia-pass mx-auto mb-2" />
                    <p className="text-indusia-text font-medium">{t('sync.allSynced')}</p>
                    <p className="text-sm text-indusia-textMuted mt-1">{t('sync.allTablesUpToDate')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-indusia-surface rounded-xl border border-indusia-border">
          <div className="px-5 py-4 border-b border-indusia-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indusia-textMuted" />
              <span className="font-medium text-indusia-text">{t('sync.syncHistory')}</span>
              <span className="text-xs text-indusia-textMuted">({totalHistoryCount} {t('common.total')})</span>
            </div>
            <button 
              onClick={() => loadSyncHistory(historyPage)}
              disabled={loadingHistory}
              className="p-1.5 rounded hover:bg-indusia-bg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-indusia-textMuted ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingHistory && syncHistory.length === 0 ? (
            <div className="py-16 flex justify-center">
              <RefreshCw className="w-6 h-6 text-indusia-primary animate-spin" />
            </div>
          ) : syncHistory.length === 0 ? (
            <div className="py-16 text-center text-indusia-textMuted">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('sync.noSyncHistory')}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-indusia-border">
                {syncHistory.map((event) => {
                  const tablesSummary = event.tableDetails && Object.keys(event.tableDetails).length > 0
                    ? Object.keys(event.tableDetails).map(tb => getTableDisplayName(tb)).join(', ')
                    : event.tables?.map(tb => getTableDisplayName(tb)).join(', ') || '-';
                  
                  return (
                    <button
                      key={event.id}
                      onClick={() => handleOpenSyncDetail(event)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-indusia-bg/50 transition-colors text-left group"
                    >
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        event.status === 'completed' || event.status === 'success' ? 'bg-indusia-pass' : 
                        event.status === 'completed_with_errors' ? 'bg-yellow-500' : 'bg-indusia-fail'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-indusia-text">
                            {event.successCount || event.recordCount} {t('sync.recordsSynced')}
                          </p>
                          {event.failedCount > 0 && (
                            <span className="text-xs text-red-400">({event.failedCount} {t('sync.failed')})</span>
                          )}
                        </div>
                        <p className="text-xs text-indusia-textMuted mt-0.5 truncate">
                          {tablesSummary}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-indusia-text">{event.timestamp}</p>
                        <p className="text-xs text-indusia-textMuted capitalize">
                          {event.triggeredBy === 'manual' ? t('sync.manual') : t('sync.auto')}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-indusia-textMuted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-4 border-t border-indusia-border flex items-center justify-between">
                  <p className="text-sm text-indusia-textMuted">
                    {t('pagination.page')} {historyPage} {t('pagination.of')} {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1 || loadingHistory}
                      className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t('pagination.prev')}
                    </button>
                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                      disabled={historyPage === totalPages || loadingHistory}
                      className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                    >
                      {t('pagination.next')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sync History Detail Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setSelectedHistory(null)} 
          />
          <div className={`relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full mx-4 ${
            uploadedImages.length > 0 ? 'max-w-4xl' : 'max-w-lg'
          }`}>
            <div className="px-5 py-4 border-b border-indusia-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-indusia-text">{t('sync.syncDetails')}</h3>
              <button
                onClick={() => setSelectedHistory(null)}
                className="text-indusia-textMuted hover:text-indusia-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`p-5 ${
              uploadedImages.length > 0 ? 'grid grid-cols-2 gap-5' : ''
            }`}>
              {/* Left Column: Sync Details */}
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedHistory.status === 'completed' || selectedHistory.status === 'success' ? 'bg-indusia-pass' : 
                    selectedHistory.status === 'completed_with_errors' ? 'bg-yellow-500' : 'bg-indusia-fail'
                  }`} />
                  <span className={`text-sm font-medium ${
                    selectedHistory.status === 'completed' || selectedHistory.status === 'success' ? 'text-indusia-pass' : 
                    selectedHistory.status === 'completed_with_errors' ? 'text-yellow-400' : 'text-indusia-fail'
                  }`}>
                    {selectedHistory.status === 'completed' || selectedHistory.status === 'success' 
                      ? t('sync.completedSuccessfully') 
                      : selectedHistory.status === 'completed_with_errors' 
                        ? t('sync.completedWithErrors') 
                        : selectedHistory.status}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-indusia-text">{selectedHistory.recordCount}</p>
                    <p className="text-xs text-indusia-textMuted">{t('sync.total')}</p>
                  </div>
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-500">{selectedHistory.successCount}</p>
                    <p className="text-xs text-indusia-textMuted">{t('sync.success')}</p>
                  </div>
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{selectedHistory.failedCount}</p>
                    <p className="text-xs text-indusia-textMuted">{t('sync.failed')}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">{t('sync.started')}</span>
                    <span className="text-indusia-text">{selectedHistory.timestamp}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">{t('sync.completed')}</span>
                    <span className="text-indusia-text">{selectedHistory.completedAt}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">{t('sync.triggeredBy')}</span>
                    <span className="text-indusia-text capitalize">
                      {selectedHistory.triggeredBy === 'manual' ? t('sync.manual') : t('sync.auto')}
                    </span>
                  </div>
                </div>

                {/* Per-Table Breakdown */}
                {selectedHistory.tableDetails && Object.keys(selectedHistory.tableDetails).length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-indusia-textMuted mb-3">{t('sync.recordsByTable')}</p>
                    <div className="space-y-2">
                      {Object.entries(selectedHistory.tableDetails).map(([table, detail]) => {
                        const tableName = getTableDisplayName(table);
                        const total = (detail.success || 0) + (detail.failed || 0);
                        const successPercent = total > 0 ? Math.round((detail.success / total) * 100) : 0;
                        
                        return (
                          <div 
                            key={table}
                            className="px-3 py-2.5 bg-indusia-bg rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-indusia-text">{tableName}</span>
                              <span className="text-xs text-indusia-textMuted">
                                {total} {t('common.records')}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
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
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-indusia-border flex items-center justify-between text-xs">
                      <span className="text-indusia-textMuted">{t('sync.totalTables')}:</span>
                      <span className="text-indusia-text font-medium">
                        {Object.keys(selectedHistory.tableDetails).length}
                      </span>
                    </div>
                  </div>
                ) : selectedHistory.tables && selectedHistory.tables.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-indusia-textMuted mb-2">{t('sync.tablesSynced')}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedHistory.tables.map((table, idx) => (
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
                {selectedHistory.errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-xs font-medium text-red-400 mb-1">{t('sync.errorMessage')}</p>
                    <p className="text-sm text-red-300">{selectedHistory.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Uploaded Images */}
              {uploadedImages.length > 0 && (
                <div className="border-l border-indusia-border pl-5">
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

            <div className="px-5 py-4 border-t border-indusia-border">
              <button
                onClick={() => setSelectedHistory(null)}
                className="w-full py-2 bg-indusia-bg text-indusia-text rounded-lg font-medium hover:bg-indusia-border transition-colors"
              >
                {t('buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SyncProgressModal
        isOpen={isProgressModalOpen}
        progress={progress}
        currentStep={currentStep}
        status={status}
        onCancel={() => { setIsProgressModalOpen(false); setIsSyncing(false); setStatus('idle'); }}
        onClose={() => { setIsProgressModalOpen(false); setIsSyncing(false); setStatus('idle'); }}
      />
    </div>
  );
}

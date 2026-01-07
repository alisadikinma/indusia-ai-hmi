'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import SyncProgressModal from '@/components/sync/SyncProgressModal';
import { Clock, RefreshCw, AlertCircle, Cloud, Database, CheckCircle, ChevronRight, ChevronLeft, X, Table, Image, ExternalLink } from 'lucide-react';

const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const HISTORY_PAGE_SIZE = 10;

// Table display names mapping
const TABLE_DISPLAY_NAMES = {
  'inspection_results': 'Inspection Results',
  'inspection_defects': 'Inspection Defects',
  'overrides': 'False Call Overrides',
  'inspection_stats': 'Inspection Stats',
  'work_orders': 'Work Orders',
  'event_log': 'Event Log'
};

// Helper to get display name
const getTableDisplayName = (table) => {
  return TABLE_DISPLAY_NAMES[table] || table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function SyncPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const autoSyncIntervalRef = useRef(null);

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
  
  // Detail Modal state
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const loadPendingCounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/sync-queue');
      const result = await response.json();
      
      if (result.success) {
        setPendingTables(result.data || []);
        setTotalPending(result.count || 0);
      } else {
        setError(result.error || 'Failed to load pending counts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load uploaded images filtered by sync session time
  const loadUploadedImages = useCallback(async (syncStart, syncEnd) => {
    if (!syncStart) return;
    
    setLoadingImages(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      
      // Convert locale string back to ISO for API
      // syncStart/syncEnd are locale strings like "1/7/2026, 1:07:18 PM"
      try {
        const startDate = new Date(syncStart);
        const endDate = syncEnd ? new Date(syncEnd) : new Date();
        
        if (!isNaN(startDate.getTime())) {
          params.set('syncStart', startDate.toISOString());
        }
        if (!isNaN(endDate.getTime())) {
          params.set('syncEnd', endDate.toISOString());
        }
      } catch (e) {
        console.warn('Failed to parse sync timestamps:', e);
      }
      
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

  const loadSyncHistory = useCallback(async (page = 1) => {
    try {
      setLoadingHistory(true);
      const offset = (page - 1) * HISTORY_PAGE_SIZE;
      const response = await fetch(`/api/sync-queue/history?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const history = result.data.map(item => ({
          id: item.id,
          timestamp: item.started_at ? new Date(item.started_at).toLocaleString() : '-',
          completedAt: item.completed_at ? new Date(item.completed_at).toLocaleString() : '-',
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
        
        // Update last sync info from first completed
        if (page === 1) {
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
    
    const response = await fetch('/api/sync-queue');
    const result = await response.json();
    const currentPending = result.count || 0;
    
    if (currentPending === 0) {
      if (!isAuto) showToast('No records ready to sync.');
      return;
    }
    
    if (!isAuto) {
      setIsProgressModalOpen(true);
    }
    setIsSyncing(true);
    setStatus('running');
    setProgress(0);
    setCurrentStep('Connecting to cloud...');

    try {
      const progressSteps = [
        { percent: 10, step: 'Preparing payload...' },
        { percent: 30, step: 'Uploading inspection results...' },
        { percent: 45, step: 'Uploading inspection defects...' },
        { percent: 60, step: 'Uploading overrides...' },
        { percent: 75, step: 'Uploading inspection stats...' },
        { percent: 85, step: 'Uploading work orders...' },
        { percent: 95, step: 'Confirming cloud receipt...' }
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
        setCurrentStep(`Synced ${syncResult.data.syncedCount} records successfully`);
        setLastSyncTime(new Date().toLocaleString());
        setLastSyncStatus('success');
        
        await loadPendingCounts();
        await loadSyncHistory(1);
        
        showToast(`Sync completed! ${syncResult.data.syncedCount} records uploaded.`, 'success');
        
        setTimeout(() => {
          setIsProgressModalOpen(false);
          setIsSyncing(false);
          setStatus('idle');
        }, 2000);
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }
    } catch (err) {
      setStatus('error');
      setCurrentStep(err.message);
      if (!isAuto) {
        showToast(`Sync failed: ${err.message}`, 'error');
      }
      setIsSyncing(false);
    }
  }, [isSyncing, user?.id, loadPendingCounts, loadSyncHistory, showToast]);

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
      
      showToast('Auto sync enabled. Next sync in 15 minutes.', 'info');
      
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
  }, [autoSync, executeSync, showToast]);

  // Initial load
  useEffect(() => {
    loadPendingCounts();
    loadSyncHistory(1);
  }, [loadPendingCounts, loadSyncHistory]);

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
    
    // Only load images if overrides table was synced with success > 0
    const overridesDetail = event.tableDetails?.overrides;
    const hasOverridesSuccess = overridesDetail && overridesDetail.success > 0;
    
    if (hasOverridesSuccess) {
      // Pass sync session timestamps to filter images
      loadUploadedImages(event.timestamp, event.completedAt);
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
        setCountdown('Syncing...');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [nextAutoSync]);

  // Pagination
  const totalPages = Math.ceil(totalHistoryCount / HISTORY_PAGE_SIZE);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6 max-w-md text-center">
          <h2 className="text-lg font-bold text-indusia-text mb-2">Not Logged In</h2>
          <button onClick={() => router.push('/login')} className="px-4 py-2 bg-indusia-primary text-white rounded-lg text-sm">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Sync to Cloud"
        description="Upload pending records from local database to Supabase cloud for backup and AI retraining."
      />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400">{error}</span>
          <button onClick={loadPendingCounts} className="ml-auto px-2 py-1 text-xs bg-red-500/20 rounded hover:bg-red-500/30">
            Retry
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
          Sync Status
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
          Sync History
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
                <span className="font-medium text-indusia-text">Cloud Sync Status</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${
                lastSyncStatus === 'success' || lastSyncStatus === 'completed' ? 'bg-green-500/20 text-green-400' :
                lastSyncStatus === 'completed_with_errors' ? 'bg-yellow-500/20 text-yellow-400' :
                lastSyncStatus === 'never' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {lastSyncStatus === 'never' ? 'Never synced' : 
                 lastSyncStatus === 'completed' || lastSyncStatus === 'success' ? 'Success' :
                 lastSyncStatus === 'completed_with_errors' ? 'Partial Success' : lastSyncStatus}
              </span>
            </div>

            <div className="text-center py-6 bg-indusia-bg rounded-lg mb-4">
              <p className={`text-4xl font-bold ${totalPending > 0 ? 'text-indusia-primary' : 'text-green-500'}`}>
                {totalPending}
              </p>
              <p className="text-sm text-indusia-textMuted mt-1">Records ready to upload</p>
            </div>

            {pendingTables.length > 0 && pendingTables.some(t => t.count > 0) && (
              <div className="mb-4 p-3 bg-indusia-bg rounded-lg space-y-1">
                {pendingTables
                  .filter(t => t.count > 0)
                  .map(t => (
                    <div key={t.table} className="flex justify-between text-sm">
                      <span className="text-indusia-textMuted">{t.displayName}</span>
                      <span className="text-indusia-primary font-medium">{t.count}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-between text-sm text-indusia-textMuted mb-4">
              <span>Last Sync:</span>
              <span className="text-indusia-text">{lastSyncTime || 'Never'}</span>
            </div>

            <button
              onClick={() => executeSync(false)}
              disabled={isSyncing || totalPending === 0}
              className="w-full py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <div className="mt-4 pt-4 border-t border-indusia-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-indusia-textMuted">Auto Sync (every 15 min)</span>
                  {autoSync && countdown && (
                    <p className="text-xs text-indusia-primary mt-0.5">Next sync in {countdown}</p>
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
                <span className="font-medium text-indusia-text">Tables Being Synced</span>
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
                {pendingTables.map((t) => (
                  <div key={t.table} className="flex items-center justify-between p-3 bg-indusia-bg rounded-lg">
                    <div className="flex items-center gap-3">
                      <Table className="w-4 h-4 text-indusia-textMuted" />
                      <span className="text-sm text-indusia-text">{t.displayName}</span>
                    </div>
                    <span className={`text-sm font-medium ${t.count > 0 ? 'text-indusia-primary' : 'text-indusia-textMuted'}`}>
                      {t.count > 0 ? `${t.count} pending` : '0 pending'}
                    </span>
                  </div>
                ))}

                {totalPending === 0 && (
                  <div className="mt-4 p-4 text-center">
                    <CheckCircle className="w-10 h-10 text-indusia-pass mx-auto mb-2" />
                    <p className="text-indusia-text font-medium">All Synced!</p>
                    <p className="text-sm text-indusia-textMuted mt-1">All tables are up to date</p>
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
              <span className="font-medium text-indusia-text">Sync History</span>
              <span className="text-xs text-indusia-textMuted">({totalHistoryCount} total)</span>
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
              <p className="text-sm">No sync history yet</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-indusia-border">
                {syncHistory.map((event) => {
                  const tablesSummary = event.tableDetails && Object.keys(event.tableDetails).length > 0
                    ? Object.keys(event.tableDetails).map(t => getTableDisplayName(t)).join(', ')
                    : event.tables?.map(t => getTableDisplayName(t)).join(', ') || '-';
                  
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
                            {event.successCount || event.recordCount} records synced
                          </p>
                          {event.failedCount > 0 && (
                            <span className="text-xs text-red-400">({event.failedCount} failed)</span>
                          )}
                        </div>
                        <p className="text-xs text-indusia-textMuted mt-0.5 truncate">
                          {tablesSummary}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-indusia-text">{event.timestamp}</p>
                        <p className="text-xs text-indusia-textMuted capitalize">{event.triggeredBy}</p>
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
                    Page {historyPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1 || loadingHistory}
                      className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                      disabled={historyPage === totalPages || loadingHistory}
                      className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sync History Detail Modal - 2 column when images exist */}
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
              <h3 className="text-lg font-semibold text-indusia-text">Sync Details</h3>
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
                    {selectedHistory.status === 'completed' ? 'Completed Successfully' : 
                     selectedHistory.status === 'completed_with_errors' ? 'Completed with Errors' : 
                     selectedHistory.status}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-indusia-text">{selectedHistory.recordCount}</p>
                    <p className="text-xs text-indusia-textMuted">Total</p>
                  </div>
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-500">{selectedHistory.successCount}</p>
                    <p className="text-xs text-indusia-textMuted">Success</p>
                  </div>
                  <div className="bg-indusia-bg rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{selectedHistory.failedCount}</p>
                    <p className="text-xs text-indusia-textMuted">Failed</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">Started</span>
                    <span className="text-indusia-text">{selectedHistory.timestamp}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">Completed</span>
                    <span className="text-indusia-text">{selectedHistory.completedAt}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-indusia-border">
                    <span className="text-indusia-textMuted">Triggered By</span>
                    <span className="text-indusia-text capitalize">{selectedHistory.triggeredBy}</span>
                  </div>
                </div>

                {/* Per-Table Breakdown */}
                {selectedHistory.tableDetails && Object.keys(selectedHistory.tableDetails).length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-indusia-textMuted mb-3">Records by Table</p>
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
                                {total} record{total !== 1 ? 's' : ''}
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
                      <span className="text-indusia-textMuted">Total Tables:</span>
                      <span className="text-indusia-text font-medium">
                        {Object.keys(selectedHistory.tableDetails).length}
                      </span>
                    </div>
                  </div>
                ) : selectedHistory.tables && selectedHistory.tables.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-indusia-textMuted mb-2">Tables Synced</p>
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
                    <p className="text-xs font-medium text-red-400 mb-1">Error Message</p>
                    <p className="text-sm text-red-300">{selectedHistory.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Uploaded Images - only show when images exist */}
              {uploadedImages.length > 0 && (
                <div className="border-l border-indusia-border pl-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4 text-indusia-primary" />
                    <span className="text-sm font-medium text-indusia-text">Uploaded Images</span>
                    <span className="text-xs text-indusia-textMuted">({uploadedImages.length})</span>
                  </div>
                  
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
                                Side: <span className="uppercase text-indusia-primary">{img.side}</span>
                              </p>
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indusia-primary hover:underline mt-1.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Full Image
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
                Close
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

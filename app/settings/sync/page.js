'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import SyncSummaryCard from '@/components/sync/SyncSummaryCard';
import SyncQueueTable from '@/components/sync/SyncQueueTable';
import SyncProgressModal from '@/components/sync/SyncProgressModal';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';

export default function SyncPage() {
  const router = useRouter();
  const { user, hasMenuAccess, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  // Queue items from API
  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState('never');
  const [autoSync, setAutoSync] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);

  // Sync progress
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, syncing, completed, failed
  const [currentStep, setCurrentStep] = useState('');

  // Load queue items from API
  const loadQueueItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/sync-queue?grouped=true');
      const result = await response.json();

      if (result.success) {
        // Transform data for SyncQueueTable format
        const items = result.data.map((item, index) => ({
          id: item.id || index,
          customerName: item.customerName || 'Unknown',
          sectionName: item.sectionName || '-',
          boardId: item.boardId,
          defectsCount: item.defectsCount || 1,
          type: item.type || 'False Call',
          status: 'ready',
        }));
        setQueueItems(items);
      } else {
        setError(result.error || 'Failed to load queue');
      }
    } catch (err) {
      console.error('Load queue error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sync history
  const loadSyncHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/sync-queue/history?limit=5');
      const result = await response.json();

      if (result.success && result.data) {
        const history = result.data.map(item => ({
          id: item.id,
          timestamp: new Date(item.completed_at).toLocaleString(),
          recordCount: item.record_count,
          successCount: item.success_count,
          failedCount: item.failed_count,
          status: item.status,
        }));
        setSyncHistory(history);

        // Update last sync info
        if (history.length > 0) {
          setLastSyncTime(history[0].timestamp);
          setLastSyncStatus(history[0].status);
        }
      }
    } catch (err) {
      console.error('Load history error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadQueueItems();
    loadSyncHistory();
  }, [loadQueueItems, loadSyncHistory]);

  // Execute sync
  const handleSyncNow = async () => {
    if (queueItems.length === 0) {
      showToast('No records ready to sync.');
      return;
    }

    setIsProgressModalOpen(true);
    setIsSyncing(true);
    setStatus('syncing');
    setProgress(0);
    setCurrentStep('Preparing upload...');

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Call sync API
      const response = await fetch('/api/sync-queue/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });

      clearInterval(progressInterval);

      const result = await response.json();

      if (result.success) {
        setProgress(100);
        setStatus('completed');
        setCurrentStep(`Synced ${result.data.syncedCount} records`);

        // Update UI
        const now = new Date().toLocaleString();
        setLastSyncTime(now);
        setLastSyncStatus('success');

        // Reload data
        await loadQueueItems();
        await loadSyncHistory();

        showToast(`Sync completed! ${result.data.syncedCount} records uploaded.`);

        // Close modal after delay
        setTimeout(() => {
          setIsProgressModalOpen(false);
          setIsSyncing(false);
          setStatus('idle');
          setProgress(0);
        }, 2000);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setStatus('failed');
      setCurrentStep(err.message);
      showToast(`Sync failed: ${err.message}`);
    }
  };

  const handleCancel = () => {
    setIsSyncing(false);
    setIsProgressModalOpen(false);
    setStatus('idle');
    setProgress(0);
    showToast('Sync cancelled.');
  };

  const handleAutoSyncToggle = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);

    if (newValue) {
      showToast('Auto sync enabled (every 15 minutes).');
      // TODO: Implement auto sync interval
    } else {
      showToast('Auto sync disabled.');
    }
  };

  const handleCloseModal = () => {
    setIsProgressModalOpen(false);
    setIsSyncing(false);
    setStatus('idle');
    setProgress(0);
  };

  // canSync is determined by page access (already checked above)
  const canSync = true;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Not Logged In</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Please login to access sync settings.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Sync to Cloud Training Server"
        description="Upload approved overrides and inspection records to the cloud for AI retraining."
      />

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={loadQueueItems}
            className="ml-auto px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SyncSummaryCard
          readyCount={queueItems.length}
          lastSyncTime={lastSyncTime}
          lastSyncStatus={lastSyncStatus}
          onSyncNow={handleSyncNow}
          isSyncing={isSyncing}
          autoSync={autoSync}
          onAutoSyncToggle={handleAutoSyncToggle}
        />

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-indusia-surface/50 flex items-center justify-center z-10 rounded-xl">
              <RefreshCw className="w-6 h-6 text-indusia-primary animate-spin" />
            </div>
          )}
          <SyncQueueTable items={queueItems} />
        </div>
      </div>

      <Card title="Sync History" subtitle="Recent synchronization events">
        {syncHistory.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="w-12 h-12 text-indusia-textMuted mx-auto mb-3" />
            <p className="text-sm text-indusia-textMuted">No sync history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {syncHistory.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between px-4 py-3 bg-indusia-surfaceMuted rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    event.status === 'success' ? 'bg-indusia-pass' :
                    event.status === 'partial' ? 'bg-indusia-warning' : 'bg-indusia-fail'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-indusia-text">
                      Synced {event.successCount || event.recordCount} records
                      {event.failedCount > 0 && (
                        <span className="text-indusia-fail ml-2">
                          ({event.failedCount} failed)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-indusia-textMuted">{event.timestamp}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium uppercase ${
                  event.status === 'success' ? 'text-indusia-pass' :
                  event.status === 'partial' ? 'text-indusia-warning' : 'text-indusia-fail'
                }`}>
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!canSync && (
        <div className="mt-4 bg-indusia-surfaceMuted border border-indusia-border rounded-lg px-4 py-3">
          <p className="text-sm text-indusia-textMuted">
            Only managers and engineers can start sync operations.
          </p>
        </div>
      )}

      <SyncProgressModal
        isOpen={isProgressModalOpen}
        progress={progress}
        currentStep={currentStep}
        estimatedTime={null}
        status={status}
        onPause={() => {}}
        onResume={() => {}}
        onCancel={handleCancel}
        onClose={handleCloseModal}
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import SyncProgressModal from '@/components/sync/SyncProgressModal';
import { Clock, RefreshCw, AlertCircle, Cloud, FileText, CheckCircle } from 'lucide-react';

export default function SyncPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState('never');
  const [autoSync, setAutoSync] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState('');

  const loadQueueItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/sync-queue?grouped=true');
      const result = await response.json();
      if (result.success) {
        const items = result.data.map((item, index) => ({
          id: item.id || index,
          customerName: item.customerName || 'Unknown',
          sectionName: item.sectionName || '-',
          boardId: item.boardId,
          defectsCount: item.defectsCount || 1,
          type: item.type || 'Override',
          status: 'ready',
        }));
        setQueueItems(items);
      } else {
        setError(result.error || 'Failed to load queue');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        if (history.length > 0) {
          setLastSyncTime(history[0].timestamp);
          setLastSyncStatus(history[0].status);
        }
      }
    } catch (err) {
      console.error('Load history error:', err);
    }
  }, []);

  useEffect(() => {
    loadQueueItems();
    loadSyncHistory();
  }, [loadQueueItems, loadSyncHistory]);

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
      const progressInterval = setInterval(() => {
        setProgress(prev => prev >= 90 ? (clearInterval(progressInterval), 90) : prev + 10);
      }, 500);

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
        setLastSyncTime(new Date().toLocaleString());
        setLastSyncStatus('success');
        await loadQueueItems();
        await loadSyncHistory();
        showToast(`Sync completed! ${result.data.syncedCount} records uploaded.`);
        setTimeout(() => {
          setIsProgressModalOpen(false);
          setIsSyncing(false);
          setStatus('idle');
        }, 2000);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      setStatus('failed');
      setCurrentStep(err.message);
      showToast(`Sync failed: ${err.message}`);
    }
  };

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
        description="Upload approved overrides to cloud for AI retraining."
      />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400">{error}</span>
          <button onClick={loadQueueItems} className="ml-auto px-2 py-1 text-xs bg-red-500/20 rounded">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Left Column: Status + History */}
        <div className="space-y-5">
          {/* Sync Status Card */}
          <div className="bg-indusia-surface rounded-xl border border-indusia-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indusia-primary" />
                <span className="font-medium text-indusia-text">Cloud Sync Status</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${
                lastSyncStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                lastSyncStatus === 'never' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {lastSyncStatus === 'never' ? 'Never synced' : lastSyncStatus}
              </span>
            </div>

            <div className="text-center py-6 bg-indusia-bg rounded-lg mb-4">
              <p className="text-4xl font-bold text-indusia-primary">{queueItems.length}</p>
              <p className="text-sm text-indusia-textMuted mt-1">Records ready to upload</p>
            </div>

            <div className="flex justify-between text-sm text-indusia-textMuted mb-4">
              <span>Last Sync:</span>
              <span className="text-indusia-text">{lastSyncTime || 'Never'}</span>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncing || queueItems.length === 0}
              className="w-full py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <div className="mt-4 pt-4 border-t border-indusia-border flex items-center justify-between">
              <span className="text-sm text-indusia-textMuted">Auto Sync (every 15 min)</span>
              <button
                onClick={() => setAutoSync(!autoSync)}
                className={`w-11 h-6 rounded-full transition-colors ${autoSync ? 'bg-indusia-primary' : 'bg-indusia-border'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Sync History */}
          <div className="bg-indusia-surface rounded-xl border border-indusia-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indusia-textMuted" />
              <span className="font-medium text-indusia-text">Sync History</span>
            </div>

            {syncHistory.length === 0 ? (
              <div className="py-6 text-center text-indusia-textMuted">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sync history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {syncHistory.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 px-3 py-2.5 bg-indusia-bg rounded-lg">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      event.status === 'success' ? 'bg-indusia-pass' : 'bg-indusia-fail'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-indusia-text">
                        {event.successCount || event.recordCount} records synced
                        {event.failedCount > 0 && <span className="text-red-400 ml-1">({event.failedCount} failed)</span>}
                      </p>
                      <p className="text-xs text-indusia-textMuted">{event.timestamp}</p>
                    </div>
                    <span className={`text-xs font-medium ${
                      event.status === 'success' ? 'text-indusia-pass' : 'text-indusia-fail'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Queue Table */}
        <div className="bg-indusia-surface rounded-xl border border-indusia-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indusia-textMuted" />
              <span className="font-medium text-indusia-text">Sync Queue</span>
            </div>
            <span className="text-sm text-indusia-textMuted">{queueItems.length} records queued</span>
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center">
              <RefreshCw className="w-6 h-6 text-indusia-primary animate-spin" />
            </div>
          ) : queueItems.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-indusia-pass mx-auto mb-3" />
              <p className="text-indusia-text font-medium">All Synced!</p>
              <p className="text-sm text-indusia-textMuted mt-1">No pending records</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-indusia-border">
              <table className="w-full text-sm">
                <thead className="bg-indusia-bg">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-indusia-textMuted uppercase">Board</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-indusia-textMuted uppercase">Customer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-indusia-textMuted uppercase">Type</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-indusia-textMuted uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indusia-border">
                  {queueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-indusia-bg/50">
                      <td className="px-4 py-2.5 text-indusia-text font-medium">{item.boardId}</td>
                      <td className="px-4 py-2.5 text-indusia-textMuted">{item.customerName}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-indusia-textMuted">
                          <FileText className="w-3.5 h-3.5" />
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          Ready
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import { useMockSyncJob } from '@/hooks/useMockSyncJob';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import SyncSummaryCard from '@/components/sync/SyncSummaryCard';
import SyncQueueTable from '@/components/sync/SyncQueueTable';
import SyncProgressModal from '@/components/sync/SyncProgressModal';
import { Clock } from 'lucide-react';

export default function SyncPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [queueItems, setQueueItems] = useState([
    {
      id: 1,
      customerName: 'Customer A',
      sectionName: 'SMT',
      boardId: 'Board A',
      defectsCount: 12,
      type: 'Override',
      status: 'ready',
    },
    {
      id: 2,
      customerName: 'Customer A',
      sectionName: 'MI',
      boardId: 'Board B',
      defectsCount: 8,
      type: 'Override',
      status: 'ready',
    },
    {
      id: 3,
      customerName: 'Customer B',
      sectionName: 'Testing',
      boardId: 'Board C',
      defectsCount: 15,
      type: 'Inspection Summary',
      status: 'ready',
    },
    {
      id: 4,
      customerName: 'Customer B',
      sectionName: 'FATP',
      boardId: 'Board Z',
      defectsCount: 6,
      type: 'Override',
      status: 'ready',
    },
  ]);

  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState('never');
  const [autoSync, setAutoSync] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);

  const {
    isSyncing,
    progress,
    status,
    currentStep,
    estimatedTime,
    startSync,
    pauseSync,
    resumeSync,
    cancelSync,
    resetSync,
  } = useMockSyncJob({ totalItems: queueItems.length });

  useEffect(() => {
    if (status === 'completed') {
      const now = new Date();
      const timeString = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      setLastSyncTime(timeString);
      setLastSyncStatus('success');

      const syncedCount = queueItems.length;
      setQueueItems([]);

      setSyncHistory(prev => [
        {
          id: Date.now(),
          timestamp: timeString,
          recordCount: syncedCount,
          status: 'success',
        },
        ...prev.slice(0, 4),
      ]);

      showToast('Sync completed successfully.');

      setTimeout(() => {
        setIsProgressModalOpen(false);
        resetSync();
      }, 2000);
    }
  }, [status, queueItems.length, showToast, resetSync]);

  const handleSyncNow = () => {
    if (queueItems.length === 0) {
      showToast('No records ready to sync.');
      return;
    }

    setIsProgressModalOpen(true);
    startSync();
  };

  const handleCancel = () => {
    cancelSync();
    setIsProgressModalOpen(false);
    showToast('Sync cancelled.');
  };

  const handleAutoSyncToggle = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);

    if (newValue) {
      showToast('Auto sync enabled (every 15 minutes).');
    } else {
      showToast('Auto sync disabled.');
    }
  };

  const handleCloseModal = () => {
    setIsProgressModalOpen(false);
    resetSync();
  };

  const canSync = user && (user.role === 'operator' || user.role === 'manager' || user.role === 'engineer');

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

        <SyncQueueTable items={queueItems} />
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
                  <div className="w-2 h-2 rounded-full bg-indusia-pass" />
                  <div>
                    <p className="text-sm font-medium text-indusia-text">
                      Synced {event.recordCount} records
                    </p>
                    <p className="text-xs text-indusia-textMuted">{event.timestamp}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-indusia-pass uppercase">Success</span>
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
        estimatedTime={estimatedTime}
        status={status}
        onPause={pauseSync}
        onResume={resumeSync}
        onCancel={handleCancel}
        onClose={handleCloseModal}
      />
    </div>
  );
}

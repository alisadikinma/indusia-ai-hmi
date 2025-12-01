import Card from '@/components/common/Card';
import StatusBadge from '@/components/common/StatusBadge';
import { Cloud, RefreshCw } from 'lucide-react';

export default function SyncSummaryCard({
  readyCount,
  lastSyncTime,
  lastSyncStatus,
  onSyncNow,
  isSyncing,
  autoSync,
  onAutoSyncToggle,
}) {
  const getStatusInfo = () => {
    if (isSyncing) {
      return { status: 'warning', label: 'Syncing...' };
    }
    if (lastSyncStatus === 'failed') {
      return { status: 'fail', label: 'Last sync failed' };
    }
    if (lastSyncStatus === 'success') {
      return { status: 'pass', label: 'Idle' };
    }
    return { status: 'warning', label: 'Never synced' };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-indusia-primary/10 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-indusia-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-indusia-text">Cloud Sync Status</h3>
              <p className="text-sm text-indusia-textMuted">Training server connection</p>
            </div>
          </div>
          <StatusBadge status={statusInfo.status} label={statusInfo.label} />
        </div>

        <div className="bg-indusia-surfaceMuted rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-indusia-primary mb-2">{readyCount}</div>
          <p className="text-sm text-indusia-textMuted">Records ready to upload to cloud training server</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-indusia-textMuted">Last Sync:</span>
            <span className="text-indusia-text font-medium">
              {lastSyncTime || 'Never'}
            </span>
          </div>

          {lastSyncStatus === 'failed' && (
            <div className="text-xs text-indusia-fail bg-indusia-fail/10 rounded px-3 py-2">
              Last sync failed. Check network connection and try again.
            </div>
          )}
        </div>

        <button
          onClick={onSyncNow}
          disabled={isSyncing || readyCount === 0}
          className="w-full px-6 py-3 bg-indusia-primary text-white rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>

        <div className="pt-4 border-t border-indusia-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indusia-text">Auto Sync</p>
              <p className="text-xs text-indusia-textMuted">Sync every 15 minutes</p>
            </div>
            <button
              onClick={onAutoSyncToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSync ? 'bg-indusia-primary' : 'bg-indusia-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

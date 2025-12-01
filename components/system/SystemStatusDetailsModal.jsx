import { X, CheckCircle, AlertTriangle, XCircle, Activity, Camera, Cloud, Settings, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const systemIcons = {
  aiModel: Activity,
  camera: Camera,
  cloud: Cloud,
  lineRuntime: Settings,
  lastSync: RefreshCw,
};

const systemTitles = {
  aiModel: 'AI Model',
  camera: 'Camera / Hardware',
  cloud: 'Cloud Connectivity',
  lineRuntime: 'Line Runtime',
  lastSync: 'Last Sync Status',
};

export default function SystemStatusDetailsModal({ isOpen, onClose, statuses, selectedSystem }) {
  if (!isOpen) return null;

  const renderStatusIcon = (state) => {
    switch (state) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-indusia-pass" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-indusia-warning" />;
      case 'error':
      case 'offline':
        return <XCircle className="w-5 h-5 text-indusia-fail" />;
      default:
        return <Activity className="w-5 h-5 text-indusia-textMuted" />;
    }
  };

  const renderSystemDetails = (key, status) => {
    const Icon = systemIcons[key];
    const details = status.details || {};

    return (
      <div key={key} className="bg-indusia-surfaceMuted rounded-lg p-4 border border-indusia-border">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-indusia-bg rounded-lg">
            <Icon className="w-5 h-5 text-indusia-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-indusia-text mb-1">
              {systemTitles[key]}
            </h3>
            <div className="flex items-center gap-2">
              {renderStatusIcon(status.state)}
              <span className="text-xs text-indusia-textMuted capitalize">
                {status.state}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-indusia-textMuted">Status:</span>
            <span className="text-indusia-text font-medium">{status.message}</span>

            <span className="text-indusia-textMuted">Last Updated:</span>
            <span className="text-indusia-text">
              {format(new Date(status.lastUpdated), 'MMM dd, HH:mm:ss')}
            </span>
          </div>

          {key === 'aiModel' && details.modelName && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indusia-border">
              <span className="text-indusia-textMuted">Model Name:</span>
              <span className="text-indusia-text font-mono">{details.modelName}</span>

              <span className="text-indusia-textMuted">Last Retrain:</span>
              <span className="text-indusia-text">{details.lastRetrain}</span>

              <span className="text-indusia-textMuted">False Call Rate:</span>
              <span className="text-indusia-text">{details.falseCallRate}</span>
            </div>
          )}

          {key === 'camera' && details.connectedCameras && (
            <div className="pt-2 border-t border-indusia-border">
              <span className="text-xs text-indusia-textMuted block mb-1">Connected Cameras:</span>
              <div className="flex flex-wrap gap-1">
                {details.connectedCameras.map((cam) => (
                  <span key={cam} className="px-2 py-1 bg-indusia-bg rounded text-xs font-mono text-indusia-text">
                    {cam}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <span className="text-indusia-textMuted">Last Heartbeat:</span>
                <span className="text-indusia-text">
                  {format(new Date(details.lastHeartbeat), 'HH:mm:ss')}
                </span>
              </div>
            </div>
          )}

          {key === 'cloud' && details.lastPing && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indusia-border">
              <span className="text-indusia-textMuted">Last Ping:</span>
              <span className="text-indusia-text">
                {format(new Date(details.lastPing), 'HH:mm:ss')}
              </span>

              <span className="text-indusia-textMuted">Latency:</span>
              <span className="text-indusia-text">{details.latency}</span>
            </div>
          )}

          {key === 'lineRuntime' && details.status && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indusia-border">
              <span className="text-indusia-textMuted">Runtime Status:</span>
              <span className="text-indusia-text font-medium">{details.status}</span>

              <span className="text-indusia-textMuted">Uptime:</span>
              <span className="text-indusia-text">{details.uptime}</span>

              <span className="text-indusia-textMuted">Boards Processed:</span>
              <span className="text-indusia-text">{details.boardsProcessed}</span>
            </div>
          )}

          {key === 'lastSync' && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indusia-border">
              {details.syncedRecords !== undefined && (
                <>
                  <span className="text-indusia-textMuted">Records Synced:</span>
                  <span className="text-indusia-text">{details.syncedRecords}</span>
                </>
              )}
              {details.error && (
                <>
                  <span className="text-indusia-textMuted">Error:</span>
                  <span className="text-indusia-fail text-xs">{details.error}</span>
                </>
              )}
              <span className="text-indusia-textMuted">Timestamp:</span>
              <span className="text-indusia-text">
                {format(new Date(details.timestamp || status.lastUpdated), 'MMM dd, HH:mm:ss')}
              </span>
            </div>
          )}

          {status.state === 'error' && key === 'lastSync' && (
            <div className="mt-3 p-3 bg-indusia-fail/10 rounded border border-indusia-fail text-xs">
              <p className="text-indusia-text font-medium mb-1">Troubleshooting:</p>
              <ul className="text-indusia-textMuted space-y-1 list-disc list-inside">
                <li>Check network connectivity</li>
                <li>Verify cloud service status</li>
                <li>Retry sync from Sync to Cloud panel</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const systemsToShow = selectedSystem
    ? [selectedSystem]
    : Object.keys(statuses);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-indusia-text">
            {selectedSystem ? systemTitles[selectedSystem] : 'System Diagnostics'}
          </h2>
          <button
            onClick={onClose}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemsToShow.map((key) => renderSystemDetails(key, statuses[key]))}
          </div>

          <div className="mt-6 p-4 bg-indusia-bg rounded-lg border border-indusia-border">
            <h4 className="text-sm font-semibold text-indusia-text mb-2">System Information</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-indusia-textMuted">HMI Version:</span>
              <span className="text-indusia-text">v1.0.0</span>

              <span className="text-indusia-textMuted">Auto-Refresh:</span>
              <span className="text-indusia-text">Every 15 seconds</span>

              <span className="text-indusia-textMuted">System Time:</span>
              <span className="text-indusia-text">
                {format(new Date(), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-indusia-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

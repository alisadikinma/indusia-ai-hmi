import { X, Pause, Play, XCircle, CheckCircle, AlertCircle } from 'lucide-react';

export default function SyncProgressModal({
  isOpen,
  progress,
  currentStep,
  estimatedTime,
  onPause,
  onResume,
  onCancel,
  onClose,
  status,
}) {
  if (!isOpen) return null;

  const stages = [
    { name: 'Prepare payload', range: [0, 25] },
    { name: 'Upload records', range: [25, 75] },
    { name: 'Confirm cloud receipt', range: [75, 95] },
    { name: 'Mark records as synced', range: [95, 100] },
  ];

  const getCurrentStage = () => {
    return stages.findIndex(stage => progress >= stage.range[0] && progress < stage.range[1]);
  };

  const currentStageIndex = getCurrentStage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div 
        className="absolute inset-0 bg-black/50" 
        onClick={(status === 'completed' || status === 'error') ? onClose : undefined} 
      />
      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-2xl mx-4">
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-indusia-text">
              {status === 'completed' ? 'Sync Completed' : status === 'error' ? 'Sync Failed' : 'Sync in Progress'}
            </h3>
            <p className="text-sm text-indusia-textMuted mt-1">
              {status === 'completed'
                ? 'All records have been successfully uploaded.'
                : status === 'error'
                ? 'An error occurred during sync.'
                : 'Do not power off the station while upload is running.'}
            </p>
          </div>
                    {(status === 'completed' || status === 'error') && (
            <button
              onClick={onClose}
              className="text-indusia-textMuted hover:text-indusia-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-6 space-y-6">
          {status === 'completed' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-indusia-pass/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-indusia-pass" />
              </div>
              <h4 className="text-xl font-semibold text-indusia-text mb-2">Successfully Synced</h4>
              <p className="text-sm text-indusia-textMuted">
                All records have been uploaded to the cloud training server.
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-indusia-fail/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-indusia-fail" />
              </div>
              <h4 className="text-xl font-semibold text-indusia-text mb-2">Sync Failed</h4>
              <p className="text-sm text-indusia-textMuted">
                An error occurred while syncing. Please check your connection and try again.
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indusia-text">Progress: {progress}%</span>
                  <span className="text-sm text-indusia-textMuted">{estimatedTime}</span>
                </div>
                <div className="w-full h-3 bg-indusia-surfaceMuted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indusia-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="bg-indusia-surfaceMuted rounded-lg p-4">
                <p className="text-xs font-semibold text-indusia-textMuted uppercase mb-2">Current Step</p>
                <p className="text-sm font-medium text-indusia-text">{currentStep}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-indusia-textMuted uppercase mb-3">Sync Stages</p>
                <div className="space-y-2">
                  {stages.map((stage, index) => {
                    const isCompleted = progress >= stage.range[1];
                    const isCurrent = index === currentStageIndex;
                    const isPending = progress < stage.range[0];

                    return (
                      <div
                        key={stage.name}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-indusia-primary/10 border border-indusia-primary'
                            : isCompleted
                            ? 'bg-indusia-pass/10'
                            : 'bg-indusia-surfaceMuted'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCompleted
                              ? 'bg-indusia-pass text-white'
                              : isCurrent
                              ? 'bg-indusia-primary text-white'
                              : 'bg-indusia-border text-indusia-textMuted'
                          }`}
                        >
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        <span
                          className={`text-sm ${
                            isCurrent || isCompleted ? 'text-indusia-text font-medium' : 'text-indusia-textMuted'
                          }`}
                        >
                          {stage.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-indusia-border flex items-center justify-end gap-3">
          {status === 'running' && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onPause}
                className="px-6 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border transition-colors flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onResume}
                className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            </>
          )}

          {status === 'completed' && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          )}

          {status === 'error' && (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border transition-colors"
              >
                Close
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

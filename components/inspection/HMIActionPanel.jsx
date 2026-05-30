'use client';

/**
 * HMI Action Panel Component
 * AI Detection display + Operator action buttons
 * ISA-101 compliant with large touch targets (30mm+)
 */

import { forwardRef, useCallback } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { HMITimer } from './HMITimer';
import { cn } from '@/lib/utils';

/**
 * Get confidence level info (Tailwind class-based for theme support)
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 85) {
    return {
      textClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      barColor: '#10B981',
      label: 'High Confidence - Auto-proceed available'
    };
  }
  if (confidence >= 60) {
    return {
      textClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10 border-amber-500/30',
      dotClass: 'bg-amber-500',
      barColor: '#F59E0B',
      label: 'Medium Confidence - Review recommended'
    };
  }
  return {
    textClass: 'text-red-500',
    bgClass: 'bg-red-500/10 border-red-500/30',
    dotClass: 'bg-red-500',
    barColor: '#EF4444',
    label: 'Low Confidence - Manual verification required'
  };
}

export const HMIActionPanel = forwardRef(function HMIActionPanel({
  // Detection data
  defectType = 'NO DEFECT',
  confidence = 0,
  historicalAccuracy = 94,
  detectionCount = { critical: 0, warning: 0, info: 0 },
  
  // Timer settings
  autoApproveEnabled = true,
  autoApproveTimeout = 15,
  isPaused = false,
  
  // Callbacks
  onApprove,
  onReject,
  onFalseCall,
  onTimeout,
  
  // State
  disabled = false,
}, ref) {
  const confidenceInfo = getConfidenceLevel(confidence);
  const hasDefect = defectType !== 'NO DEFECT' && defectType !== 'PASS';

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (disabled || isPaused) return;
    
    switch (e.key.toLowerCase()) {
      case 'a':
        onApprove?.();
        break;
      case 'r':
        onReject?.();
        break;
      case 'f':
        onFalseCall?.();
        break;
    }
  }, [disabled, isPaused, onApprove, onReject, onFalseCall]);

  return (
    <div
      ref={ref}
      className="flex flex-col h-full p-4 gap-4 bg-void"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* AI Detection Card */}
      <div className="rounded-xl p-4 border transition-colors bg-elevated border-surface-border">
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-text-tertiary">
          AI DETECTION
        </h3>

        {/* Defect Type */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-4 h-4 rounded-full",
              hasDefect ? "bg-red-500 animate-pulse" : "bg-emerald-500"
            )}
          />
          <span className="text-xl font-bold text-text-primary">
            {defectType}
          </span>
        </div>

        {/* Confidence Meter */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-text-tertiary">
              Confidence
            </span>
            <span className={cn("text-3xl font-bold", confidenceInfo.textClass)}>
              {confidence}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 rounded-full overflow-hidden bg-terminal">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${confidence}%`,
                background: `linear-gradient(to right, ${confidenceInfo.barColor}CC, ${confidenceInfo.barColor})`
              }}
            />
          </div>

          <p className="text-xs mt-2 text-text-tertiary">
            Historically correct {historicalAccuracy}% of the time
          </p>
        </div>

        {/* Confidence Badge */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", confidenceInfo.bgClass)}>
          <div className={cn("w-2 h-2 rounded-full", confidenceInfo.dotClass)} />
          <span className={cn("text-sm font-medium", confidenceInfo.textClass)}>
            {confidenceInfo.label}
          </span>
        </div>
      </div>

      {/* Auto-Approve Timer */}
      {autoApproveEnabled && (
        <div className="rounded-xl p-4 border transition-colors bg-elevated border-surface-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide mb-1 text-text-tertiary">
                AUTO-APPROVE IN
              </h3>
              <p className="text-xs text-text-tertiary">
                {isPaused ? 'Timer paused' : 'Take action or wait'}
              </p>
            </div>

            <HMITimer
              duration={autoApproveTimeout}
              isPaused={isPaused}
              onTimeout={onTimeout}
              showWarning={true}
              warningThreshold={5}
              size={96}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex-1 flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          OPERATOR ACTION
        </h3>

        {/* APPROVE Button */}
        <button
          onClick={onApprove}
          disabled={disabled || isPaused}
          className={cn(
            "flex-1 min-h-[85px] rounded-2xl flex items-center justify-center gap-4",
            "transition-all duration-150 transform shadow-xl text-white",
            "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
            "hover:scale-[1.02] active:scale-[0.98]",
            (disabled || isPaused) && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
        >
          <Check size={32} strokeWidth={3} />
          <span className="text-2xl font-black tracking-wide">APPROVE</span>
        </button>

        {/* REJECT Button */}
        <button
          onClick={onReject}
          disabled={disabled || isPaused}
          className={cn(
            "flex-1 min-h-[85px] rounded-2xl flex items-center justify-center gap-4",
            "transition-all duration-150 transform shadow-xl text-white",
            "bg-red-600 hover:bg-red-500 active:bg-red-700",
            "hover:scale-[1.02] active:scale-[0.98]",
            (disabled || isPaused) && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
        >
          <X size={32} strokeWidth={3} />
          <span className="text-2xl font-black tracking-wide">REJECT</span>
        </button>

        {/* FALSE CALL Button */}
        <button
          onClick={onFalseCall}
          disabled={disabled || isPaused}
          className={cn(
            "flex-1 min-h-[85px] rounded-2xl flex items-center justify-center gap-4",
            "transition-all duration-150 transform shadow-xl text-white",
            "bg-orange-500 hover:bg-orange-400 active:bg-orange-600",
            "hover:scale-[1.02] active:scale-[0.98]",
            (disabled || isPaused) && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
        >
          <AlertTriangle size={28} strokeWidth={2.5} />
          <span className="text-xl font-black tracking-wide">FALSE CALL</span>
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="flex items-center justify-center gap-4 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 rounded font-mono border bg-elevated border-surface-border">A</kbd>
          <span>Approve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 rounded font-mono border bg-elevated border-surface-border">R</kbd>
          <span>Reject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 rounded font-mono border bg-elevated border-surface-border">F</kbd>
          <span>False</span>
        </div>
      </div>
    </div>
  );
});

HMIActionPanel.displayName = 'HMIActionPanel';

export default HMIActionPanel;

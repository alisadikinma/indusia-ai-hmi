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
 * Get confidence level info
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 85) {
    return { 
      color: '#10B981', 
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      label: 'High Confidence - Auto-proceed available' 
    };
  }
  if (confidence >= 60) {
    return { 
      color: '#F59E0B', 
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      label: 'Medium Confidence - Review recommended' 
    };
  }
  return { 
    color: '#EF4444', 
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
  
  // Theme
  theme = 'dark',
  themeColors,
  
  // State
  disabled = false,
}, ref) {
  
  // Default theme colors
  const colors = themeColors || {
    bg: theme === 'dark' ? '#0A1628' : '#F5F5F5',
    surface: theme === 'dark' ? '#1A2942' : '#FFFFFF',
    border: theme === 'dark' ? '#2D3E56' : '#D0D0D0',
    text: theme === 'dark' ? '#E8EDF2' : '#1A1A1A',
    textMuted: theme === 'dark' ? '#8A95A8' : '#666666',
    primary: theme === 'dark' ? '#0FB5BA' : '#0D9488',
  };

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
      className="flex flex-col h-full p-4 gap-4"
      style={{ backgroundColor: colors.bg }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* AI Detection Card */}
      <div 
        className="rounded-xl p-4 border transition-colors"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <h3 
          className="text-xs font-medium uppercase tracking-wide mb-3"
          style={{ color: colors.textMuted }}
        >
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
          <span 
            className="text-xl font-bold"
            style={{ color: colors.text }}
          >
            {defectType}
          </span>
        </div>

        {/* Confidence Meter */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm" style={{ color: colors.textMuted }}>
              Confidence
            </span>
            <span 
              className="text-3xl font-bold"
              style={{ color: confidenceInfo.color }}
            >
              {confidence}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div 
            className="h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: theme === 'dark' ? '#0D1B2A' : '#E0E0E0' }}
          >
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${confidence}%`,
                background: `linear-gradient(to right, ${confidenceInfo.color}CC, ${confidenceInfo.color})`
              }}
            />
          </div>
          
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Historically correct {historicalAccuracy}% of the time
          </p>
        </div>

        {/* Confidence Badge */}
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ 
            backgroundColor: confidenceInfo.bgColor,
            border: `1px solid ${confidenceInfo.borderColor}`
          }}
        >
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: confidenceInfo.color }}
          />
          <span 
            className="text-sm font-medium"
            style={{ color: confidenceInfo.color }}
          >
            {confidenceInfo.label}
          </span>
        </div>
      </div>

      {/* Auto-Approve Timer */}
      {autoApproveEnabled && (
        <div 
          className="rounded-xl p-4 border transition-colors"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: colors.textMuted }}
              >
                AUTO-APPROVE IN
              </h3>
              <p className="text-xs" style={{ color: colors.textMuted }}>
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
              theme={theme}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex-1 flex flex-col gap-3">
        <h3 
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: colors.textMuted }}
        >
          OPERATOR ACTION
        </h3>
        
        {/* APPROVE Button - Min 30mm height (~110px) */}
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
          style={{ boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}
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
          style={{ boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.4)' }}
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
          style={{ boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)' }}
        >
          <AlertTriangle size={28} strokeWidth={2.5} />
          <span className="text-xl font-black tracking-wide">FALSE CALL</span>
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div 
        className="flex items-center justify-center gap-4 text-xs"
        style={{ color: colors.textMuted }}
      >
        <div className="flex items-center gap-1.5">
          <kbd 
            className="px-2 py-1 rounded font-mono border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            A
          </kbd>
          <span>Approve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd 
            className="px-2 py-1 rounded font-mono border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            R
          </kbd>
          <span>Reject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd 
            className="px-2 py-1 rounded font-mono border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            F
          </kbd>
          <span>False</span>
        </div>
      </div>
    </div>
  );
});

HMIActionPanel.displayName = 'HMIActionPanel';

export default HMIActionPanel;

'use client';

/**
 * Detection Result Panel - Compact Version
 * Simplified for better focus on inspection
 */

import { AlertTriangle, AlertCircle, Info, CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';

const SEVERITY_CONFIG = {
  critical: {
    label: 'CRITICAL',
    color: 'text-phosphor-red',
    bgColor: 'bg-phosphor-red/10',
    borderColor: 'border-phosphor-red/50',
  },
  major: {
    label: 'MAJOR',
    color: 'text-phosphor-teal',
    bgColor: 'bg-phosphor-teal/10',
    borderColor: 'border-phosphor-teal/50',
  },
  minor: {
    label: 'MINOR',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/50',
  },
};

const DEFECT_DISPLAY_NAMES = {
  solder_bridge: 'Solder Bridge',
  insufficient_solder: 'Insufficient Solder',
  cold_solder: 'Cold Solder',
  solder_ball: 'Solder Ball',
  missing_component: 'Missing Component',
  tombstone: 'Tombstone',
  misalignment: 'Misalignment',
};

export function DetectionResultPanel({
  detection,
  isLoading = false,
  aiResult = 'WAITING',
  defectIndex = 0,
  defectCount = 0,
}) {
  const { t } = useI18n();

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-terminal border border-surface-border">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-phosphor-teal border-t-transparent animate-spin mx-auto mb-2" />
          <p className="font-mono text-xs text-text-tertiary">{t('hmi.analyzing')}</p>
        </div>
      </div>
    );
  }

  // PASS / GOOD state
  if (!detection || aiResult === 'GOOD' || aiResult === 'PASS') {
    return (
      <div className="h-full flex flex-col bg-terminal border border-phosphor-green/30">
        <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-green/10 border-b border-phosphor-green/30">
          <CheckCircle2 className="w-4 h-4 text-phosphor-green" />
          <span className="font-display font-bold text-sm text-phosphor-green tracking-wide">
            {t('inspection.aiResultPass')}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-phosphor-green/50 mx-auto mb-2" />
            <p className="font-display text-base text-phosphor-green">{t('inspection.noDefectsDetected')}</p>
            <p className="font-mono text-xs text-text-tertiary mt-1">{t('inspection.boardPassedAI')}</p>
          </div>
        </div>
      </div>
    );
  }

  // WAITING state
  if (aiResult === 'WAITING') {
    return (
      <div className="h-full flex flex-col bg-terminal border border-surface-border">
        <div className="flex items-center gap-2 px-3 py-2 bg-panel border-b border-surface-border">
          <Info className="w-4 h-4 text-text-tertiary" />
          <span className="font-display font-bold text-sm text-text-tertiary tracking-wide">
            {t('inspection.aiResultWaiting')}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-surface-border border-dashed flex items-center justify-center mx-auto mb-2">
              <Target className="w-6 h-6 text-text-tertiary" />
            </div>
            <p className="font-mono text-xs text-text-tertiary">{t('inspection.waitingForInspection')}</p>
          </div>
        </div>
      </div>
    );
  }

  // NG / DEFECT state
  const {
    class_name,
    confidence,
    severity = 'major',
    component_ref,
    pin_number,
    ipc_reference,
  } = detection;

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.major;
  const displayName = DEFECT_DISPLAY_NAMES[class_name] || class_name?.replace(/_/g, ' ');
  const confidencePercent = Math.round((confidence || 0) * 100);

  return (
    <div className="h-full flex flex-col bg-terminal border border-surface-border overflow-hidden">
      {/* Header - Compact */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b",
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn("w-4 h-4", config.color)} />
          <span className={cn("font-display font-bold text-sm tracking-wide", config.color)}>
            {t('inspection.defectDetected')}
          </span>
        </div>
        {defectCount > 1 && (
          <span className="font-mono text-xs text-phosphor-teal">
            {defectIndex + 1}/{defectCount}
          </span>
        )}
      </div>

      {/* Content - Compact */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {/* Defect Type + Severity */}
        <div className={cn("p-3 border", config.bgColor, config.borderColor)}>
          <div className="flex items-center justify-between mb-1">
            <span className={cn("font-display text-base font-bold uppercase", config.color)}>
              {displayName}
            </span>
            <span className={cn(
              "px-2 py-0.5 font-mono text-xs font-bold border",
              config.bgColor, config.borderColor, config.color
            )}>
              {config.label}
            </span>
          </div>
          
          {/* Confidence inline */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-void border border-surface-border">
              <div
                className={cn("h-full", {
                  'bg-phosphor-red': confidencePercent >= 85,
                  'bg-phosphor-teal': confidencePercent >= 60 && confidencePercent < 85,
                  'bg-yellow-400': confidencePercent < 60,
                })}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className={cn("font-mono text-sm font-bold w-12 text-right", config.color)}>
              {confidencePercent}%
            </span>
          </div>
        </div>

        {/* Location - Compact single row */}
        {(component_ref || pin_number) && (
          <div className="flex items-center gap-3 px-3 py-2 bg-void border border-surface-border">
            <Target className="w-4 h-4 text-phosphor-cyan flex-shrink-0" />
            <span className="font-mono text-sm">
              <span className="text-phosphor-cyan font-bold">{component_ref}</span>
              {pin_number && (
                <span className="text-text-secondary ml-2">• {pin_number}</span>
              )}
            </span>
            {ipc_reference && (
              <span className="ml-auto font-mono text-xs text-text-tertiary">
                {ipc_reference.replace('IPC-A-610 ', '')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DetectionResultPanel;

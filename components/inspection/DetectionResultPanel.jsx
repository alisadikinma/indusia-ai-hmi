'use client';

/**
 * Detection Result Panel
 * Shows AI detection details with severity and IPC reference
 */

import { AlertTriangle, AlertCircle, Info, CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

// Severity configuration
const SEVERITY_CONFIG = {
  critical: {
    label: 'CRITICAL',
    color: 'text-phosphor-red',
    bgColor: 'bg-phosphor-red/10',
    borderColor: 'border-phosphor-red/50',
    icon: AlertTriangle,
  },
  major: {
    label: 'MAJOR',
    color: 'text-phosphor-amber',
    bgColor: 'bg-phosphor-amber/10',
    borderColor: 'border-phosphor-amber/50',
    icon: AlertCircle,
  },
  minor: {
    label: 'MINOR',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/50',
    icon: Info,
  },
};

// Defect type to display name mapping
const DEFECT_DISPLAY_NAMES = {
  solder_bridge: 'Solder Bridge',
  solder_short: 'Solder Short',
  insufficient_solder: 'Insufficient Solder',
  excess_solder: 'Excess Solder',
  cold_solder: 'Cold Solder Joint',
  solder_ball: 'Solder Ball',
  non_wetting: 'Non-Wetting',
  missing_component: 'Missing Component',
  wrong_component: 'Wrong Component',
  reversed_polarity: 'Reversed Polarity',
  tombstone: 'Tombstoning',
  misalignment: 'Misalignment',
  lifted_lead: 'Lifted Lead',
  damaged_component: 'Damaged Component',
  contamination: 'Contamination',
};

// IPC descriptions
const IPC_DESCRIPTIONS = {
  solder_bridge: 'Solder connecting adjacent conductors that should not be connected',
  solder_short: 'Unintended solder connection between conductors',
  insufficient_solder: 'Solder joint does not meet minimum fillet requirements',
  excess_solder: 'Solder quantity exceeds acceptable limits',
  missing_component: 'Component is absent from designated location',
  tombstone: 'Component standing on end with one termination not soldered',
  misalignment: 'Component offset from nominal position beyond tolerance',
};

export function DetectionResultPanel({
  detection,
  isLoading = false,
  aiResult = 'FAIL', // 'PASS', 'FAIL', 'REVIEW'
  defectIndex = 0,
  defectCount = 0,
}) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-terminal border border-surface-border">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs text-text-tertiary">ANALYZING...</p>
        </div>
      </div>
    );
  }

  // No detection = PASS
  if (!detection || aiResult === 'PASS') {
    return (
      <div className="h-full flex flex-col bg-terminal border border-phosphor-green/30">
        <div className="flex items-center gap-2 px-4 py-3 bg-phosphor-green/10 border-b border-phosphor-green/30">
          <CheckCircle2 className="w-5 h-5 text-phosphor-green" />
          <span className="font-display font-bold text-phosphor-green tracking-wide">
            AI RESULT: PASS
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-phosphor-green/50 mx-auto mb-4" />
            <p className="font-display text-lg text-phosphor-green mb-2">NO DEFECTS DETECTED</p>
            <p className="font-mono text-xs text-text-tertiary">
              Board passed AI inspection
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    class_name,
    confidence,
    severity = 'major',
    component_ref,
    pin_number,
    ipc_reference,
  } = detection;

  const severityConfig = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.major;
  const SeverityIcon = severityConfig.icon;
  const displayName = DEFECT_DISPLAY_NAMES[class_name] || class_name?.replace(/_/g, ' ');
  const ipcDescription = IPC_DESCRIPTIONS[class_name];
  const confidencePercent = Math.round((confidence || 0) * 100);

  return (
    <div className="h-full flex flex-col bg-terminal border border-surface-border">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        severityConfig.bgColor,
        severityConfig.borderColor
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn("w-5 h-5", severityConfig.color)} />
          <span className={cn("font-display font-bold tracking-wide", severityConfig.color)}>
            AI RESULT: DEFECT DETECTED
          </span>
        </div>
        {defectCount > 1 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-void border border-surface-border">
            <span className="font-mono text-xs text-text-tertiary">Defect</span>
            <span className="font-mono text-sm font-bold text-phosphor-amber">
              {defectIndex + 1}/{defectCount}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Defect Type */}
        <div className={cn(
          "p-4 border",
          severityConfig.bgColor,
          severityConfig.borderColor
        )}>
          <div className="flex items-start gap-3">
            <SeverityIcon className={cn("w-8 h-8 flex-shrink-0", severityConfig.color)} />
            <div className="flex-1">
              <h3 className={cn("font-display text-xl font-bold", severityConfig.color)}>
                {displayName?.toUpperCase()}
              </h3>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn(
                  "px-2 py-1 font-mono text-xs font-bold border",
                  severityConfig.bgColor,
                  severityConfig.borderColor,
                  severityConfig.color
                )}>
                  {severityConfig.label}
                </span>
                <span className="font-mono text-sm text-text-secondary">
                  Confidence: <span className={severityConfig.color}>{confidencePercent}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-tertiary">AI CONFIDENCE</span>
            <span className={cn("font-mono text-sm font-bold", severityConfig.color)}>
              {confidencePercent}%
            </span>
          </div>
          <div className="h-3 bg-void border border-surface-border">
            <div
              className={cn("h-full transition-all duration-500", {
                'bg-phosphor-red': confidencePercent >= 85,
                'bg-phosphor-amber': confidencePercent >= 60 && confidencePercent < 85,
                'bg-yellow-400': confidencePercent < 60,
              })}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Location */}
        {(component_ref || pin_number) && (
          <div className="p-3 bg-void border border-surface-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-phosphor-cyan" />
              <span className="font-mono text-xs text-text-tertiary">LOCATION</span>
            </div>
            <div className="flex items-center gap-4">
              {component_ref && (
                <div>
                  <span className="font-mono text-xs text-text-tertiary">Component: </span>
                  <span className="font-mono text-lg font-bold text-phosphor-cyan">
                    {component_ref}
                  </span>
                </div>
              )}
              {pin_number && (
                <div>
                  <span className="font-mono text-xs text-text-tertiary">Pin: </span>
                  <span className="font-mono text-lg font-bold text-text-primary">
                    {pin_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IPC Reference */}
        {(ipc_reference || ipcDescription) && (
          <div className="p-3 bg-void border border-surface-border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-text-tertiary" />
              <span className="font-mono text-xs text-text-tertiary">IPC-A-610 REFERENCE</span>
            </div>
            {ipc_reference && (
              <p className="font-mono text-sm text-phosphor-amber mb-2">{ipc_reference}</p>
            )}
            {ipcDescription && (
              <p className="font-mono text-xs text-text-secondary leading-relaxed">
                "{ipcDescription}"
              </p>
            )}
          </div>
        )}

        {/* IPC Classification */}
        <div className="p-3 bg-void border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-tertiary">IPC CLASS 2 VERDICT</span>
            <span className={cn(
              "px-3 py-1 font-mono text-xs font-bold border",
              severityConfig.bgColor,
              severityConfig.borderColor,
              severityConfig.color
            )}>
              DEFECT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetectionResultPanel;

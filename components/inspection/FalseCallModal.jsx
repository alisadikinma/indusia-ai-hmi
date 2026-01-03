'use client';

/**
 * False Call Modal
 * Supports both:
 * - False Positive: AI detected NG but board is actually GOOD
 * - Missed Defect: AI detected GOOD but board actually has defect (NG)
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Flag, MessageSquare, Send, AlertCircle, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// False call reasons for NG → actually GOOD (false positive)
const FALSE_POSITIVE_REASONS = [
  { code: 'REFLECTION', name: 'Reflection/Lighting Issue', description: 'False detection caused by light reflection or shadow' },
  { code: 'ACCEPTABLE_VARIATION', name: 'Acceptable Variation', description: 'Within acceptable tolerance per IPC standards' },
  { code: 'WRONG_CLASSIFICATION', name: 'Wrong Classification', description: 'AI classified defect type incorrectly' },
  { code: 'NORMAL_SOLDER', name: 'Normal Solder Appearance', description: 'Solder joint is actually acceptable' },
  { code: 'BACKGROUND_NOISE', name: 'Background/Noise', description: 'Detection triggered by PCB pattern or background' },
  { code: 'COMPONENT_MARKING', name: 'Component Marking', description: 'Misidentified component marking as defect' },
  { code: 'OTHER', name: 'Other Reason', description: 'Other reason not listed above' },
];

// False call reasons for GOOD → actually NG (missed defect)
const MISSED_DEFECT_REASONS = [
  { code: 'SOLDER_BRIDGE', name: 'Solder Bridge Missed', description: 'AI missed solder bridge defect' },
  { code: 'INSUFFICIENT_SOLDER', name: 'Insufficient Solder Missed', description: 'AI missed insufficient solder' },
  { code: 'MISSING_COMPONENT', name: 'Missing Component Missed', description: 'AI missed a missing component' },
  { code: 'COLD_SOLDER', name: 'Cold Solder Missed', description: 'AI missed cold solder joint' },
  { code: 'TOMBSTONE', name: 'Tombstone Missed', description: 'AI missed tombstoning defect' },
  { code: 'MISALIGNMENT', name: 'Misalignment Missed', description: 'AI missed component misalignment' },
  { code: 'OTHER_DEFECT', name: 'Other Defect Missed', description: 'AI missed other type of defect' },
];

export function FalseCallModal({
  isOpen,
  onClose,
  onSubmit,
  boardId,
  defectType,
  aiResult = 'NG', // 'NG' for false positive, 'GOOD' for missed defect
  isProcessing = false,
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Determine which mode we're in
  const isMissedDefect = aiResult === 'GOOD';
  const reasons = isMissedDefect ? MISSED_DEFECT_REASONS : FALSE_POSITIVE_REASONS;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setNotes('');
      setError('');
    }
  }, [isOpen]);

  // Handle ESC key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen && !isProcessing) {
      onClose();
    }
  }, [isOpen, isProcessing, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle submit
  const handleSubmit = () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    if ((selectedReason === 'OTHER' || selectedReason === 'OTHER_DEFECT') && !notes.trim()) {
      setError('Please provide details for "Other" reason');
      return;
    }

    onSubmit({
      reason: selectedReason,
      reasonName: reasons.find(r => r.code === selectedReason)?.name,
      notes: notes.trim(),
      falseCallType: isMissedDefect ? 'MISSED_DEFECT' : 'FALSE_POSITIVE',
    });
  };

  if (!isOpen) return null;

  const selectedReasonData = reasons.find(r => r.code === selectedReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-void/80"
        onClick={() => !isProcessing && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        <div className={cn(
          "bg-panel border-2 shadow-lg",
          isMissedDefect 
            ? "border-phosphor-red shadow-glow-red" 
            : "border-phosphor-amber shadow-glow-amber"
        )}>
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between px-6 py-4 border-b",
            isMissedDefect 
              ? "bg-phosphor-red/10 border-phosphor-red/30" 
              : "bg-phosphor-amber/10 border-phosphor-amber/30"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 flex items-center justify-center border",
                isMissedDefect 
                  ? "bg-phosphor-red/20 border-phosphor-red" 
                  : "bg-phosphor-amber/20 border-phosphor-amber"
              )}>
                {isMissedDefect ? (
                  <AlertTriangle className="w-5 h-5 text-phosphor-red" />
                ) : (
                  <Flag className="w-5 h-5 text-phosphor-amber" />
                )}
              </div>
              <div>
                <h2 className={cn(
                  "font-display text-lg font-bold tracking-wide",
                  isMissedDefect ? "text-phosphor-red" : "text-phosphor-amber"
                )}>
                  {isMissedDefect ? 'REPORT MISSED DEFECT' : 'REPORT FALSE CALL'}
                </h2>
                <p className="font-mono text-xs text-text-tertiary">
                  {isMissedDefect 
                    ? 'AI detected GOOD but defect exists' 
                    : `AI Detection: ${defectType?.replace(/_/g, ' ').toUpperCase()}`
                  }
                </p>
              </div>
            </div>
            
            {!isProcessing && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            {/* Board ID */}
            <div className="flex items-center gap-3 p-3 bg-terminal border border-surface-border">
              <span className="font-mono text-xs text-text-tertiary">Board:</span>
              <span className="font-mono text-sm font-bold text-text-primary">{boardId}</span>
              <span className={cn(
                "ml-auto px-2 py-0.5 font-mono text-xs font-bold border",
                isMissedDefect 
                  ? "bg-phosphor-green/10 border-phosphor-green/50 text-phosphor-green" 
                  : "bg-phosphor-red/10 border-phosphor-red/50 text-phosphor-red"
              )}>
                AI: {aiResult}
              </span>
            </div>

            {/* Info banner */}
            <div className={cn(
              "flex items-start gap-3 p-3 border",
              isMissedDefect 
                ? "bg-phosphor-red/5 border-phosphor-red/30" 
                : "bg-phosphor-amber/5 border-phosphor-amber/30"
            )}>
              <Eye className={cn(
                "w-5 h-5 flex-shrink-0 mt-0.5",
                isMissedDefect ? "text-phosphor-red" : "text-phosphor-amber"
              )} />
              <div className="font-mono text-xs text-text-secondary">
                {isMissedDefect ? (
                  <>
                    <strong className="text-phosphor-red">Missed Defect:</strong> AI passed this board but you found a defect. 
                    Board will be <strong>REJECTED</strong> and data collected for AI retraining.
                  </>
                ) : (
                  <>
                    <strong className="text-phosphor-amber">False Positive:</strong> AI flagged a defect but board is actually good. 
                    Board will <strong>CONTINUE</strong> and data collected for AI retraining.
                  </>
                )}
              </div>
            </div>

            {/* Reason Selection */}
            <div>
              <label className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-text-tertiary" />
                <span className="font-mono text-xs text-text-tertiary">
                  SELECT REASON <span className="text-phosphor-red">*</span>
                </span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((reason) => (
                  <button
                    key={reason.code}
                    onClick={() => {
                      setSelectedReason(reason.code);
                      setError('');
                    }}
                    className={cn(
                      "p-3 text-left border transition-all",
                      selectedReason === reason.code
                        ? isMissedDefect
                          ? "bg-phosphor-red/10 border-phosphor-red text-phosphor-red"
                          : "bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber"
                        : "bg-terminal border-surface-border text-text-secondary hover:border-text-tertiary"
                    )}
                  >
                    <p className="font-mono text-xs font-bold truncate">{reason.name}</p>
                  </button>
                ))}
              </div>

              {/* Selected reason description */}
              {selectedReasonData && (
                <p className="mt-2 font-mono text-xs text-text-tertiary italic">
                  "{selectedReasonData.description}"
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-text-tertiary" />
                <span className="font-mono text-xs text-text-tertiary">
                  ADDITIONAL NOTES {(selectedReason === 'OTHER' || selectedReason === 'OTHER_DEFECT') && <span className="text-phosphor-red">*</span>}
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isMissedDefect 
                  ? "Describe the defect you found (location, type)..." 
                  : "Optional notes for this false call..."
                }
                rows={3}
                className={cn(
                  "w-full px-3 py-2 bg-terminal border font-mono text-sm",
                  "placeholder:text-text-tertiary text-text-primary",
                  "focus:outline-none",
                  isMissedDefect ? "focus:border-phosphor-red" : "focus:border-phosphor-amber",
                  "border-surface-border"
                )}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-red/10 border border-phosphor-red/30">
                <AlertCircle className="w-4 h-4 text-phosphor-red" />
                <span className="font-mono text-xs text-phosphor-red">{error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-6 py-4 bg-terminal border-t border-surface-border">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className={cn(
                "flex-1 h-12 font-display text-sm font-bold tracking-wider",
                "border border-surface-border text-text-secondary",
                "hover:border-text-tertiary transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              CANCEL
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !selectedReason}
              className={cn(
                "flex-1 h-12 flex items-center justify-center gap-2",
                "font-display text-sm font-bold tracking-wider",
                "transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isMissedDefect
                  ? "bg-phosphor-red text-void hover:shadow-glow-red"
                  : "bg-phosphor-amber text-void hover:shadow-glow-amber"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-void border-t-transparent animate-spin" />
                  <span>SUBMITTING...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{isMissedDefect ? 'REJECT BOARD' : 'SUBMIT & CONTINUE'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FalseCallModal;

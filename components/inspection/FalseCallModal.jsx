'use client';

/**
 * False Call Modal
 * Form for reporting AI false positive with reason and notes
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Flag, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// False call reason options (matches database seed)
const FALSE_CALL_REASONS = [
  { code: 'REFLECTION', name: 'Reflection/Lighting Issue', description: 'False detection caused by light reflection or shadow' },
  { code: 'ACCEPTABLE_VARIATION', name: 'Acceptable Variation', description: 'Within acceptable tolerance per IPC standards' },
  { code: 'WRONG_CLASSIFICATION', name: 'Wrong Classification', description: 'AI classified defect type incorrectly' },
  { code: 'NORMAL_SOLDER', name: 'Normal Solder Appearance', description: 'Solder joint is actually acceptable' },
  { code: 'BACKGROUND_NOISE', name: 'Background/Noise', description: 'Detection triggered by PCB pattern or background' },
  { code: 'COMPONENT_MARKING', name: 'Component Marking', description: 'Misidentified component marking as defect' },
  { code: 'TRAINING_NEEDED', name: 'AI Training Needed', description: 'Model needs training for this pattern' },
  { code: 'OTHER', name: 'Other Reason', description: 'Other reason not listed above' },
];

export function FalseCallModal({
  isOpen,
  onClose,
  onSubmit,
  boardId,
  defectType,
  isProcessing = false,
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

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

    if (selectedReason === 'OTHER' && !notes.trim()) {
      setError('Please provide details for "Other" reason');
      return;
    }

    onSubmit({
      reason: selectedReason,
      reasonName: FALSE_CALL_REASONS.find(r => r.code === selectedReason)?.name,
      notes: notes.trim(),
    });
  };

  if (!isOpen) return null;

  const selectedReasonData = FALSE_CALL_REASONS.find(r => r.code === selectedReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-void/80"
        onClick={() => !isProcessing && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        <div className="bg-panel border-2 border-phosphor-amber shadow-glow-amber">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-phosphor-amber/10 border-b border-phosphor-amber/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-phosphor-amber/20 border border-phosphor-amber">
                <Flag className="w-5 h-5 text-phosphor-amber" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-phosphor-amber tracking-wide">
                  REPORT FALSE CALL
                </h2>
                <p className="font-mono text-xs text-text-tertiary">
                  AI Detection: {defectType?.replace(/_/g, ' ').toUpperCase()}
                </p>
              </div>
            </div>
            
            {!isProcessing && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-phosphor-amber/10 transition-colors"
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
                {FALSE_CALL_REASONS.map((reason) => (
                  <button
                    key={reason.code}
                    onClick={() => {
                      setSelectedReason(reason.code);
                      setError('');
                    }}
                    className={cn(
                      "p-3 text-left border transition-all",
                      selectedReason === reason.code
                        ? "bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber"
                        : "bg-terminal border-surface-border text-text-secondary hover:border-phosphor-amber/50"
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
                  ADDITIONAL NOTES {selectedReason === 'OTHER' && <span className="text-phosphor-red">*</span>}
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this false call..."
                rows={3}
                className={cn(
                  "w-full px-3 py-2 bg-terminal border font-mono text-sm",
                  "placeholder:text-text-tertiary text-text-primary",
                  "focus:border-phosphor-amber focus:outline-none",
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

            {/* Info */}
            <p className="font-mono text-xxs text-text-tertiary">
              This feedback helps improve AI accuracy. Board will continue (NEXT signal sent to PLC).
            </p>
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
                "bg-phosphor-amber text-void",
                "hover:shadow-glow-amber transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <span>SUBMIT & CONTINUE</span>
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

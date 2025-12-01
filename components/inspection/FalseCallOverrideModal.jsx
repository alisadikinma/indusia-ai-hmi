'use client';

import { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

export default function FalseCallOverrideModal({
  isOpen,
  onClose,
  onConfirm,
  defect,
  boardId,
  timestamp,
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !defect) return null;

  const reasons = [
    { value: 'acceptable', label: 'Acceptable solder joint (AI over-sensitive)' },
    { value: 'lighting', label: 'Lighting artifact (reflection/shadow)' },
    { value: 'variation', label: 'Component variation (within tolerance)' },
    { value: 'alignment', label: 'Label alignment within spec' },
    { value: 'other', label: 'Other (specify in notes)' },
  ];

  const handleConfirm = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);

    setTimeout(() => {
      onConfirm({
        defectId: defect.id,
        reason: selectedReason,
        notes,
      });
      setIsSubmitting(false);
      setSelectedReason('');
      setNotes('');
    }, 150);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedReason('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-indusia-surface rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden border-t-4 border-indusia-primary">
        <div className="px-8 py-6 border-b border-indusia-border flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-indusia-warning/20 flex items-center justify-center flex-shrink-0 mt-1">
              <AlertTriangle className="w-5 h-5 text-indusia-warning" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-indusia-text">
                Operator Override – False Call Report
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Board:</span> {boardId}
                </p>
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Time:</span> {timestamp}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-4 uppercase tracking-wide">
              Select Override Reason
            </h3>
            <div className="space-y-3">
              {reasons.map((reason) => (
                <label
                  key={reason.value}
                  className={`
                    flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all
                    ${
                      selectedReason === reason.value
                        ? 'border-indusia-primary bg-indusia-primary/10'
                        : 'border-indusia-border bg-indusia-surfaceMuted hover:border-indusia-primary/50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-0.5 w-4 h-4 text-indusia-primary"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-indusia-text flex-1">
                    {reason.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-4 uppercase tracking-wide">
              Image Comparison
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border overflow-hidden">
                <div className="px-4 py-3 border-b border-indusia-border">
                  <p className="text-sm font-semibold text-indusia-text">
                    AI Detection
                  </p>
                </div>
                <div className="p-4">
                  <div className="bg-indusia-bg rounded-lg h-52 flex items-center justify-center relative border-2 border-indusia-fail">
                    <div className="absolute inset-8 border-2 border-indusia-fail rounded" />
                    <p className="text-xs text-indusia-textMuted text-center">
                      [Defect crop with bounding box]
                    </p>
                  </div>
                  <p className="text-xs text-indusia-textMuted mt-3 text-center">
                    Detected: <span className="text-indusia-fail font-medium">{defect.type}</span> ({defect.confidence}% confidence)
                  </p>
                </div>
              </div>

              <div className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border overflow-hidden">
                <div className="px-4 py-3 border-b border-indusia-border">
                  <p className="text-sm font-semibold text-indusia-text">
                    Operator View
                  </p>
                </div>
                <div className="p-4">
                  <div className="bg-indusia-bg rounded-lg h-52 flex items-center justify-center relative border-2 border-indusia-pass">
                    <CheckCircle className="w-12 h-12 text-indusia-pass opacity-20" />
                    <p className="text-xs text-indusia-textMuted text-center absolute">
                      [Good sample reference]
                    </p>
                  </div>
                  <p className="text-xs text-indusia-textMuted mt-3 text-center">
                    <span className="text-indusia-pass font-medium">Acceptable Quality</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-3 uppercase tracking-wide">
              Additional Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes (optional)..."
              rows={4}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-indusia-surfaceMuted border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent resize-none disabled:opacity-50"
            />
          </div>

          <div className="bg-indusia-surfaceMuted border border-indusia-border rounded-lg px-4 py-3">
            <p className="text-xs text-indusia-textMuted leading-relaxed">
              This data will be logged for model improvement and quality records.
            </p>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-indusia-border flex items-center justify-end gap-4">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={!selectedReason || isSubmitting}
            className="px-8 py-3 bg-indusia-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                CONFIRM OVERRIDE → MARK AS PASS
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

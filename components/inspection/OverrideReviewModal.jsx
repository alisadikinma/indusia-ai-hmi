'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle, XCircle } from 'lucide-react';

export default function OverrideReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  override,
}) {
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !override) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      onApprove(override.id, reviewerNotes);
      setIsProcessing(false);
      setReviewerNotes('');
    }, 150);
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      onReject(override.id, reviewerNotes);
      setIsProcessing(false);
      setReviewerNotes('');
    }, 150);
  };

  const handleClose = () => {
    if (isProcessing) return;
    setReviewerNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-indusia-surface rounded-xl shadow-2xl w-full max-w-[780px] mx-4 overflow-hidden border-t-4 border-indusia-primary">
        <div className="px-8 py-6 border-b border-indusia-border flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-indusia-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-5 h-5 text-indusia-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-indusia-text">
                Review Override Request
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Board:</span> {override.boardId}
                </p>
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Submitted:</span> {override.timestamp} by {override.operator}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-4 uppercase tracking-wide">
              AI Detection
            </h3>
            <div className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border p-4">
              <div className="bg-indusia-bg rounded-lg h-48 flex items-center justify-center relative border-2 border-indusia-fail">
                <div className="absolute inset-8 border-2 border-indusia-fail rounded" />
                <p className="text-xs text-indusia-textMuted text-center">
                  [AI Detection Image]
                </p>
              </div>
              <p className="text-xs text-indusia-textMuted mt-3 text-center">
                AI flagged: <span className="text-indusia-fail font-medium">{override.defectType}</span> ({override.confidence}% confidence)
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-3 uppercase tracking-wide">
              Operator's Reason
            </h3>
            <div className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border px-4 py-3">
              <p className="text-sm text-indusia-text">
                {override.reason}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-3 uppercase tracking-wide">
              Operator Notes
            </h3>
            <div className="bg-indusia-bg rounded-lg border border-indusia-border px-4 py-3 min-h-[80px]">
              {override.operatorNotes ? (
                <p className="text-sm text-indusia-text whitespace-pre-wrap">
                  {override.operatorNotes}
                </p>
              ) : (
                <p className="text-sm text-indusia-textMuted italic">
                  No additional notes
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indusia-text mb-3 uppercase tracking-wide">
              Reviewer Notes (Optional)
            </h3>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Add your review notes here..."
              rows={6}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-indusia-surfaceMuted border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent resize-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-indusia-border flex items-center justify-end gap-4">
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="px-6 py-3 border-2 border-red-500 text-red-500 rounded-lg font-semibold text-sm hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            Reject
          </button>

          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="px-8 py-3 bg-indusia-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Approve & Mark as False Call
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

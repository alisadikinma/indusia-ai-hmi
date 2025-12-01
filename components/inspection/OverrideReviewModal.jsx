'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { logOverrideApproved, logOverrideRejected } from '@/lib/eventLogger';
import { notifyOverrideApproved, notifyOverrideRejected } from '@/lib/notificationHelper';

export default function OverrideReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  override,
}) {
  const { user } = useAuth();
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !override) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Call the approve callback (which calls useOverrides.approveOverride)
      await onApprove(override.id, reviewerNotes);

      // Log event (non-blocking)
      logOverrideApproved(user?.id, {
        overrideId: override.id,
        boardId: override.boardId,
        notes: reviewerNotes,
      });

      // Notify operator (non-blocking)
      notifyOverrideApproved(override.operatorId || override.operator_id, {
        boardId: override.boardId,
      });

      setReviewerNotes('');
    } catch (err) {
      console.error('Failed to approve override:', err);
      setError(err.message || 'Failed to approve override');
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Call the reject callback (which calls useOverrides.rejectOverride)
      await onReject(override.id, reviewerNotes);

      // Log event (non-blocking)
      logOverrideRejected(user?.id, {
        overrideId: override.id,
        boardId: override.boardId,
        notes: reviewerNotes,
      });

      // Notify operator (non-blocking)
      notifyOverrideRejected(
        override.operatorId || override.operator_id,
        { boardId: override.boardId },
        reviewerNotes
      );

      setReviewerNotes('');
    } catch (err) {
      console.error('Failed to reject override:', err);
      setError(err.message || 'Failed to reject override');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setReviewerNotes('');
    setError(null);
    onClose();
  };

  // Check if override is already reviewed (not pending)
  const isReviewed = override.status !== 'pending';

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
                {isReviewed ? 'View Override Request' : 'Review Override Request'}
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Board:</span> {override.boardId}
                </p>
                <p className="text-sm text-indusia-textMuted">
                  <span className="font-medium text-indusia-text">Submitted:</span> {override.timestamp || override.createdAt} by {override.operator || override.operatorName}
                </p>
                {isReviewed && (
                  <p className="text-sm">
                    <span className={`font-medium ${override.status === 'approved' ? 'text-indusia-pass' : 'text-indusia-fail'}`}>
                      Status: {override.status.toUpperCase()}
                    </span>
                  </p>
                )}
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
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

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

          {isReviewed ? (
            <div>
              <h3 className="text-sm font-semibold text-indusia-text mb-3 uppercase tracking-wide">
                Reviewer Notes
              </h3>
              <div className="bg-indusia-bg rounded-lg border border-indusia-border px-4 py-3 min-h-[80px]">
                {override.reviewerNotes || override.reviewNotes ? (
                  <p className="text-sm text-indusia-text whitespace-pre-wrap">
                    {override.reviewerNotes || override.reviewNotes}
                  </p>
                ) : (
                  <p className="text-sm text-indusia-textMuted italic">
                    No reviewer notes
                  </p>
                )}
              </div>
            </div>
          ) : (
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
          )}
        </div>

        <div className="px-8 py-6 border-t border-indusia-border flex items-center justify-end gap-4">
          {isReviewed ? (
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium text-sm hover:bg-indusia-border transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-6 py-3 border-2 border-red-500 text-red-500 rounded-lg font-semibold text-sm hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

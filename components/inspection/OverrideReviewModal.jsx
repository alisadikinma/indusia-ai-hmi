'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle, XCircle, ImageIcon } from 'lucide-react';
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
  const [imageError, setImageError] = useState(false);

  if (!isOpen || !override) return null;

  // Build image URL from local path
  const getImageUrl = () => {
    const localPath = override.localImagePath || override.local_image_path;
    if (!localPath) return null;
    // Serve from local storage API
    return `/api/storage/false-calls/${localPath}`;
  };

  const imageUrl = getImageUrl();

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await onApprove(override.id, reviewerNotes);

      logOverrideApproved(user?.id, {
        overrideId: override.id,
        boardId: override.boardId,
        notes: reviewerNotes,
      });

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
      await onReject(override.id, reviewerNotes);

      logOverrideRejected(user?.id, {
        overrideId: override.id,
        boardId: override.boardId,
        notes: reviewerNotes,
      });

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
    setImageError(false);
    onClose();
  };

  const isReviewed = override.status !== 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-indusia-surface rounded-xl shadow-2xl w-full max-w-[600px] mx-4 overflow-hidden border-t-4 border-indusia-primary">
        {/* Header - Compact */}
        <div className="px-5 py-4 border-b border-indusia-border flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-indusia-primary/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-indusia-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-indusia-text">
                {isReviewed ? 'View Override' : 'Review Override'}
              </h2>
              <p className="text-xs text-indusia-textMuted mt-0.5">
                <span className="font-medium text-indusia-text">{override.boardId}</span>
                {' • '}{override.operator || override.operatorName}
                {isReviewed && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                    override.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {override.status.toUpperCase()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors disabled:opacity-50 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Compact */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* AI Detection Image */}
          <div>
            <h3 className="text-xs font-semibold text-indusia-textMuted mb-2 uppercase tracking-wide">
              AI Detection
            </h3>
            <div className="bg-indusia-bg rounded-lg border border-indusia-border overflow-hidden">
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt="False call image"
                  className="w-full h-40 object-contain bg-black"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-indusia-textMuted">
                  <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                  <p className="text-xs">No image available</p>
                </div>
              )}
            </div>
            <p className="text-xs text-indusia-textMuted mt-1.5 text-center">
              AI flagged: <span className="text-indusia-fail font-medium">{override.defectType || override.defect_type || 'Unknown'}</span>
              {override.confidence && ` (${override.confidence}%)`}
            </p>
          </div>

          {/* Two columns for reason and notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className="text-xs font-semibold text-indusia-textMuted mb-1.5 uppercase tracking-wide">
                Reason
              </h3>
              <div className="bg-indusia-bg rounded border border-indusia-border px-3 py-2">
                <p className="text-sm text-indusia-text">{override.reason || '-'}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-indusia-textMuted mb-1.5 uppercase tracking-wide">
                Operator Notes
              </h3>
              <div className="bg-indusia-bg rounded border border-indusia-border px-3 py-2 min-h-[36px]">
                <p className="text-sm text-indusia-text">
                  {override.operatorNotes || override.operator_notes || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Reviewer Notes */}
          {isReviewed ? (
            <div>
              <h3 className="text-xs font-semibold text-indusia-textMuted mb-1.5 uppercase tracking-wide">
                Reviewer Notes
              </h3>
              <div className="bg-indusia-bg rounded border border-indusia-border px-3 py-2 min-h-[36px]">
                <p className="text-sm text-indusia-text">
                  {override.reviewNotes || override.review_notes || '-'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-indusia-textMuted mb-1.5 uppercase tracking-wide">
                Reviewer Notes (Optional)
              </h3>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Add notes..."
                rows={2}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-1 focus:ring-indusia-primary resize-none disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="px-5 py-3 border-t border-indusia-border flex items-center justify-end gap-3">
          {isReviewed ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium text-sm hover:bg-indusia-border transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-4 py-2 border border-red-500 text-red-500 rounded-lg font-medium text-sm hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>

              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-5 py-2 bg-indusia-primary text-white rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve
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

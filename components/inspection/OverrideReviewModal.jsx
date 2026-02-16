'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, FileText, CheckCircle, XCircle, ImageIcon, ChevronLeft, ChevronRight, Eye, Layers, Hash, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { logOverrideApproved, logOverrideRejected } from '@/lib/eventLogger';
import { notifyOverrideApproved, notifyOverrideRejected } from '@/lib/notificationHelper';

export default function OverrideReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  onReview,
  override,
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [showRawImage, setShowRawImage] = useState(false);

  // Per-frame review state
  const [frameDecisions, setFrameDecisions] = useState({});
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Parse ng_frame_details into flat frame list
  const allFrames = useMemo(() => {
    if (!override) return [];
    const raw = override.ngFrameDetails || override.ng_frame_details;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      // Deduplicate objects within each frame (AI may return overlapping bboxes)
      return parsed.map(frame => ({
        ...frame,
        objects: (frame.objects || []).filter((obj, i, arr) => {
          for (let j = 0; j < i; j++) {
            if (arr[j].name === obj.name && arr[j].box && obj.box &&
              Math.abs(arr[j].box[0] - obj.box[0]) < 10 &&
              Math.abs(arr[j].box[1] - obj.box[1]) < 10 &&
              Math.abs(arr[j].box[2] - obj.box[2]) < 10 &&
              Math.abs(arr[j].box[3] - obj.box[3]) < 10) return false;
          }
          return true;
        })
      }));
    } catch {
      return [];
    }
  }, [override]);

  const isMultiFrame = allFrames.length > 0;
  const totalFrames = allFrames.length;
  const currentFrame = allFrames[reviewIndex] || null;

  // Load existing decisions for read-only view
  const existingDecisions = useMemo(() => {
    if (!override) return null;
    const raw = override.frameDecisions || override.frame_decisions;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }, [override]);

  const isAlreadyReviewed = override?.status === 'reviewed' || override?.status === 'approved' || override?.status === 'rejected';
  const isPending = override?.status === 'pending';

  // Reset state when override changes
  useEffect(() => {
    if (!override) return;
    setReviewerNotes('');
    setError(null);
    setImageError(false);
    setShowRawImage(false);
    setReviewIndex(0);
    setShowSummary(false);
    setIsProcessing(false);
    // Load existing decisions for read-only, or start fresh
    if (existingDecisions) {
      setFrameDecisions(existingDecisions);
    } else {
      setFrameDecisions({});
    }
  }, [override?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame key helper
  const getFrameKey = useCallback((frame) => {
    if (!frame) return '';
    return `${frame.side}-${frame.frameIndex}`;
  }, []);

  // Count decisions
  const reviewedCount = Object.keys(frameDecisions).length;
  const approvedCount = Object.values(frameDecisions).filter(d => d === 'approved').length;
  const rejectedCount = Object.values(frameDecisions).filter(d => d === 'rejected').length;
  const allReviewed = isMultiFrame && reviewedCount === totalFrames;

  // Find next unreviewed frame
  const findNextUnreviewed = useCallback((fromIndex, decisions) => {
    for (let i = 0; i < totalFrames; i++) {
      const idx = (fromIndex + i) % totalFrames;
      const key = getFrameKey(allFrames[idx]);
      if (!decisions[key]) return idx;
    }
    return -1; // all reviewed
  }, [totalFrames, allFrames, getFrameKey]);

  // Per-frame decision handler
  const handleFrameDecision = useCallback((decision) => {
    if (!currentFrame || isAlreadyReviewed) return;
    const key = getFrameKey(currentFrame);
    const newDecisions = { ...frameDecisions, [key]: decision };
    setFrameDecisions(newDecisions);

    // Auto-advance to next unreviewed
    const nextIdx = findNextUnreviewed(reviewIndex + 1, newDecisions);
    if (nextIdx === -1) {
      // All frames reviewed — show summary after brief delay
      setTimeout(() => setShowSummary(true), 600);
    } else {
      setReviewIndex(nextIdx);
      setImageError(false);
      setShowRawImage(false);
    }
  }, [currentFrame, isAlreadyReviewed, frameDecisions, reviewIndex, getFrameKey, findNextUnreviewed]);

  // Submit all frame decisions
  const handleSubmitReview = async () => {
    if (!onReview || !allReviewed) return;
    setIsProcessing(true);
    setError(null);
    try {
      await onReview(override.id, frameDecisions, reviewerNotes);
      setReviewerNotes('');
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to submit review:', err);
      setError(err.message || 'Failed to submit review');
      setIsProcessing(false);
    }
  };

  // Legacy single-decision handlers (for non-multi-frame overrides)
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
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to approve override:', err);
      setError(err.message || t('manager.failedToApprove'));
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
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to reject override:', err);
      setError(err.message || t('manager.failedToReject'));
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setReviewerNotes('');
    setError(null);
    setImageError(false);
    setShowRawImage(false);
    setFrameDecisions({});
    setReviewIndex(0);
    setShowSummary(false);
    onClose();
  };

  // Keyboard shortcuts for per-frame review
  useEffect(() => {
    if (!isOpen || !isMultiFrame || !isPending || showSummary) return;

    const handleKeyDown = (e) => {
      const key = currentFrame ? getFrameKey(currentFrame) : '';
      const isCurrentReviewed = frameDecisions[key] != null;

      if (e.key === 'a' || e.key === 'A') {
        if (!isCurrentReviewed) {
          e.preventDefault();
          handleFrameDecision('approved');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (!isCurrentReviewed) {
          e.preventDefault();
          handleFrameDecision('rejected');
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setReviewIndex(prev => Math.max(0, prev - 1));
        setImageError(false);
        setShowRawImage(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setReviewIndex(prev => Math.min(totalFrames - 1, prev + 1));
        setImageError(false);
        setShowRawImage(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMultiFrame, isPending, showSummary, currentFrame, frameDecisions, getFrameKey, handleFrameDecision, totalFrames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build image URL
  const getFrameImageUrl = (frame) => {
    if (!frame) return null;
    const imgPath = showRawImage ? frame.imageRawPath : frame.imageAnnotatedPath;
    if (!imgPath) {
      return frame.imageAnnotatedPath ? `/api/storage/false-calls/${frame.imageAnnotatedPath}` : null;
    }
    return `/api/storage/false-calls/${imgPath}`;
  };

  const getLegacyImageUrl = () => {
    const localPath = override?.localImagePath || override?.local_image_path;
    if (!localPath) return null;
    return `/api/storage/false-calls/${localPath}`;
  };

  if (!isOpen || !override) return null;

  const currentKey = currentFrame ? getFrameKey(currentFrame) : '';
  const currentDecision = frameDecisions[currentKey];
  const isCurrentReviewed = currentDecision != null;

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={cn(
        "bg-panel rounded-xl shadow-2xl mx-4 overflow-hidden border border-surface-border flex flex-col",
        isMultiFrame ? "w-full max-w-[920px] max-h-[90vh]" : "w-full max-w-[600px]"
      )}>
        {/* ============ Header ============ */}
        <div className="px-5 py-3 border-b border-surface-border flex items-start justify-between bg-terminal shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-phosphor-teal/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-phosphor-teal" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-text-primary">
                {isAlreadyReviewed ? t('manager.viewOverride') : t('manager.reviewOverride')}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-text-primary">{override.boardId}</span>
                <span>{override.operator || override.operatorName}</span>
                {isMultiFrame && !showSummary && (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal text-xs font-mono font-bold">
                      Frame {reviewIndex + 1}/{totalFrames}
                    </span>
                    {reviewedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-phosphor-cyan/20 text-phosphor-cyan text-xs font-mono">
                        {reviewedCount}/{totalFrames} reviewed
                      </span>
                    )}
                  </>
                )}
                {isAlreadyReviewed && override.status !== 'reviewed' && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    override.status === 'approved' ? "bg-phosphor-green/20 text-phosphor-green" : "bg-phosphor-red/20 text-phosphor-red"
                  )}>
                    {override.status === 'approved' ? t('manager.approved').toUpperCase() : t('manager.rejected').toUpperCase()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ============ Body ============ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {error && (
            <div className="bg-phosphor-red/10 border border-phosphor-red/30 rounded-lg px-3 py-2">
              <p className="text-xs text-phosphor-red">{error}</p>
            </div>
          )}

          {isMultiFrame && showSummary ? (
            /* ============ Summary View (after all frames reviewed) ============ */
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-10 h-10 text-phosphor-teal mx-auto mb-2" />
                <h3 className="text-lg font-display font-bold text-text-primary">
                  All Frames Reviewed
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  {approvedCount} approved, {rejectedCount} rejected
                </p>
              </div>

              {/* Per-frame decision summary */}
              <div className="space-y-1">
                {allFrames.map((frame, idx) => {
                  const key = getFrameKey(frame);
                  const decision = frameDecisions[key];
                  return (
                    <div key={key} className="flex items-center gap-3 bg-elevated rounded px-3 py-2 border border-surface-border">
                      <button
                        onClick={() => { setShowSummary(false); setReviewIndex(idx); }}
                        className="flex items-center gap-2 flex-1 text-left hover:text-phosphor-teal transition-colors"
                      >
                        <span className="text-xs font-mono text-text-tertiary w-16">{frame.side} F{frame.frameIndex}</span>
                        <span className="text-xs text-text-secondary truncate">
                          {frame.serialNumber || '-'}
                        </span>
                      </button>
                      <span className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium",
                        decision === 'approved' ? "bg-phosphor-green/15 text-phosphor-green" : "bg-phosphor-red/15 text-phosphor-red"
                      )}>
                        {decision === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {decision === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reviewer notes */}
              {isPending && (
                <div>
                  <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                    {t('manager.reviewerNotesOptional')}
                  </h3>
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder={t('manager.addNotes')}
                    rows={2}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 bg-elevated border border-surface-border rounded text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-teal resize-none disabled:opacity-50"
                  />
                </div>
              )}
            </div>

          ) : isMultiFrame ? (
            /* ============ Per-Frame Review View ============ */
            <>
              {/* Main frame image */}
              {currentFrame && (
                <div className="space-y-3">
                  <div className="relative bg-void rounded-lg border border-surface-border overflow-hidden">
                    {/* AI/RAW toggle */}
                    <div className="absolute top-2 right-2 z-10 flex rounded-md border border-surface-border bg-void/80 backdrop-blur-sm overflow-hidden">
                      <button
                        onClick={() => setShowRawImage(false)}
                        className={cn(
                          "px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors",
                          !showRawImage ? "bg-phosphor-teal/20 text-phosphor-teal" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        <Layers className="w-3 h-3" />
                        AI
                      </button>
                      <button
                        onClick={() => setShowRawImage(true)}
                        disabled={!currentFrame.imageRawPath}
                        className={cn(
                          "px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors",
                          showRawImage ? "bg-phosphor-cyan/20 text-phosphor-cyan" : "text-text-tertiary hover:text-text-secondary",
                          !currentFrame.imageRawPath && "opacity-30 cursor-not-allowed"
                        )}
                      >
                        <Eye className="w-3 h-3" />
                        RAW
                      </button>
                    </div>

                    {/* SN badge */}
                    {currentFrame.serialNumber && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-void/80 border border-phosphor-teal/50 backdrop-blur-sm">
                        <span className="font-mono text-xs font-bold text-phosphor-teal">
                          SN: {currentFrame.serialNumber}
                        </span>
                      </div>
                    )}

                    {/* Nav arrows */}
                    {totalFrames > 1 && (
                      <>
                        <button
                          onClick={() => { setReviewIndex(i => Math.max(0, i - 1)); setImageError(false); setShowRawImage(false); }}
                          disabled={reviewIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-void/70 border border-surface-border text-text-secondary hover:text-phosphor-teal disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setReviewIndex(i => Math.min(totalFrames - 1, i + 1)); setImageError(false); setShowRawImage(false); }}
                          disabled={reviewIndex === totalFrames - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-void/70 border border-surface-border text-text-secondary hover:text-phosphor-teal disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {getFrameImageUrl(currentFrame) && !imageError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getFrameImageUrl(currentFrame)}
                        alt={`${currentFrame.side} frame ${currentFrame.frameIndex}`}
                        className="w-full h-56 object-contain bg-black"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center text-text-tertiary">
                        <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                        <p className="text-xs">{t('manager.noImageAvailable')}</p>
                      </div>
                    )}
                  </div>

                  {/* Frame metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <MetaCell label="Side" value={currentFrame.side} />
                    <MetaCell label="Frame" value={`F${currentFrame.frameIndex}`} />
                    <MetaCell label="SN" value={currentFrame.serialNumber || '-'} />
                    <MetaCell label="Position" value={currentFrame.position ?? '-'} />
                    <MetaCell label="Reason" value={currentFrame.falseCallReason || '-'} highlight />
                  </div>

                  {/* Detected objects */}
                  {currentFrame.objects?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-mono text-text-tertiary uppercase mb-1.5">
                        Detected Objects ({currentFrame.objects.length})
                      </h4>
                      <div className="space-y-1">
                        {currentFrame.objects.map((obj, i) => (
                          <div key={i} className="flex items-center gap-3 bg-elevated rounded px-3 py-1.5 border border-surface-border">
                            <span className="text-sm text-phosphor-red font-medium flex-shrink-0">{obj.name}</span>
                            <span className="text-xs text-text-tertiary font-mono">
                              {obj.score != null ? `${(obj.score * 100).toFixed(1)}%` : '-'}
                            </span>
                            {obj.box && (
                              <span className="text-xs text-text-tertiary font-mono ml-auto">
                                [{obj.box.map(v => Math.round(v)).join(', ')}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Frame thumbnail strip */}
              {totalFrames > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 justify-center">
                  {allFrames.map((frame, idx) => {
                    const key = getFrameKey(frame);
                    const isActive = idx === reviewIndex;
                    const decision = frameDecisions[key];
                    const hasDecision = decision != null;

                    return (
                      <button
                        key={key}
                        onClick={() => { setReviewIndex(idx); setImageError(false); setShowRawImage(false); }}
                        className={cn(
                          "relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-all",
                          isActive ? "border-phosphor-teal ring-2 ring-phosphor-teal/30"
                            : hasDecision ? (decision === 'approved' ? "border-phosphor-green/80" : "border-phosphor-red/80")
                            : "border-surface-border hover:border-text-tertiary"
                        )}
                      >
                        {frame.imageAnnotatedPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/storage/false-calls/${frame.imageAnnotatedPath}`}
                            alt={`${frame.side} F${frame.frameIndex}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-elevated flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-text-tertiary" />
                          </div>
                        )}
                        {/* Side label */}
                        <div className="absolute bottom-0 inset-x-0 bg-void/80 text-center">
                          <span className="text-xxs font-mono text-text-primary">
                            {frame.side} F{frame.frameIndex}
                          </span>
                        </div>
                        {/* Decision badge */}
                        <div className={cn(
                          "absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                          hasDecision
                            ? (decision === 'approved' ? "bg-phosphor-green" : "bg-phosphor-red")
                            : "bg-text-tertiary/50"
                        )}>
                          {hasDecision
                            ? (decision === 'approved'
                              ? <CheckCircle className="w-3 h-3 text-white" />
                              : <XCircle className="w-3 h-3 text-white" />)
                            : <AlertCircle className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>

          ) : (
            /* ============ Legacy Single-Image View ============ */
            <>
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wide">
                  {t('manager.aiDetection')}
                </h3>
                <div className="bg-void rounded-lg border border-surface-border overflow-hidden">
                  {getLegacyImageUrl() && !imageError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getLegacyImageUrl()}
                      alt="False call image"
                      className="w-full h-40 object-contain bg-black"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-text-tertiary">
                      <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                      <p className="text-xs">{t('manager.noImageAvailable')}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-text-tertiary mt-1.5 text-center">
                  {t('manager.aiFlagged')}: <span className="text-phosphor-red font-medium">{override.defectType || override.defect_type || 'Unknown'}</span>
                  {override.confidence && ` (${override.confidence}%)`}
                </p>
              </div>
            </>
          )}

          {/* Reason + Notes (shared, shown when NOT in summary) */}
          {!showSummary && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                  {t('hmi.reason')}
                </h3>
                <div className="bg-elevated rounded border border-surface-border px-3 py-2">
                  <p className="text-sm text-text-primary">{override.reason || '-'}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                  {t('manager.operatorNotes')}
                </h3>
                <div className="bg-elevated rounded border border-surface-border px-3 py-2 min-h-[36px]">
                  <p className="text-sm text-text-primary">
                    {override.operatorNotes || override.operator_notes || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reviewer Notes for non-multi-frame or already-reviewed */}
          {!isMultiFrame && (
            isAlreadyReviewed ? (
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                  {t('manager.reviewerNotes')}
                </h3>
                <div className="bg-elevated rounded border border-surface-border px-3 py-2 min-h-[36px]">
                  <p className="text-sm text-text-primary">
                    {override.reviewNotes || override.review_notes || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                  {t('manager.reviewerNotesOptional')}
                </h3>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder={t('manager.addNotes')}
                  rows={2}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 bg-elevated border border-surface-border rounded text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-teal resize-none disabled:opacity-50"
                />
              </div>
            )
          )}

          {/* Read-only reviewer notes for already-reviewed multi-frame */}
          {isMultiFrame && isAlreadyReviewed && !showSummary && (
            <div>
              <h3 className="text-xs font-semibold text-text-tertiary mb-1.5 uppercase tracking-wide">
                {t('manager.reviewerNotes')}
              </h3>
              <div className="bg-elevated rounded border border-surface-border px-3 py-2 min-h-[36px]">
                <p className="text-sm text-text-primary">
                  {override.reviewNotes || override.review_notes || '-'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ============ Footer ============ */}
        <div className="px-5 py-3 border-t border-surface-border flex items-center justify-between gap-3 bg-terminal shrink-0">
          {isMultiFrame && showSummary && isPending ? (
            /* Summary footer: Back + Submit */
            <>
              <button
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 bg-elevated text-text-primary rounded-lg font-medium text-sm hover:bg-surface-border transition-colors"
              >
                Back to Review
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isProcessing || !allReviewed}
                className="px-6 py-2 bg-phosphor-teal text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-teal-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                    {t('manager.processing')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Review ({approvedCount} / {rejectedCount})
                  </>
                )}
              </button>
            </>

          ) : isMultiFrame && isPending ? (
            /* Per-frame footer: Approve/Reject buttons */
            <>
              {/* Keyboard hint */}
              <div className="text-xs text-text-tertiary font-mono">
                A = Approve &middot; R = Reject &middot; &larr;&rarr; Navigate
              </div>
              {isCurrentReviewed ? (
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-mono text-sm px-3 py-1 rounded",
                    currentDecision === 'approved' ? "bg-phosphor-green/20 text-phosphor-green" : "bg-phosphor-red/20 text-phosphor-red"
                  )}>
                    {currentDecision === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  {allReviewed && (
                    <button
                      onClick={() => setShowSummary(true)}
                      className="px-4 py-2 bg-phosphor-teal text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-teal-bright transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Review Summary
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleFrameDecision('rejected')}
                    disabled={isProcessing}
                    className="px-5 py-2 border border-phosphor-red text-phosphor-red rounded-lg font-medium text-sm hover:bg-phosphor-red/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                    <span className="text-xs opacity-60 font-mono">(R)</span>
                  </button>
                  <button
                    onClick={() => handleFrameDecision('approved')}
                    disabled={isProcessing}
                    className="px-5 py-2 bg-phosphor-green text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-green-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                    <span className="text-xs opacity-60 font-mono">(A)</span>
                  </button>
                </div>
              )}
            </>

          ) : isAlreadyReviewed ? (
            /* Read-only footer */
            <div className="flex items-center justify-end w-full">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-elevated text-text-primary rounded-lg font-medium text-sm hover:bg-surface-border transition-colors"
              >
                {t('buttons.close')}
              </button>
            </div>

          ) : (
            /* Legacy single-decision footer */
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-4 py-2 border border-phosphor-red text-phosphor-red rounded-lg font-medium text-sm hover:bg-phosphor-red/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-phosphor-red/30 border-t-phosphor-red rounded-full animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {t('manager.reject')}
              </button>

              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-5 py-2 bg-phosphor-green text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-green-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                    {t('manager.processing')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {t('manager.approve')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value, highlight }) {
  return (
    <div className={cn(
      "rounded border px-2 py-1.5 text-center",
      highlight ? "bg-phosphor-teal/5 border-phosphor-teal/20" : "bg-elevated border-surface-border"
    )}>
      <div className="text-xxs text-text-tertiary font-mono uppercase">{label}</div>
      <div className={cn(
        "text-sm font-mono truncate",
        highlight ? "text-phosphor-teal" : "text-text-primary"
      )}>{value}</div>
    </div>
  );
}

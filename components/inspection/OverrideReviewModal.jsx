'use client';

import { useState, useMemo } from 'react';
import { X, FileText, CheckCircle, XCircle, ImageIcon, ChevronLeft, ChevronRight, Eye, Layers, Hash } from 'lucide-react';
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
  override,
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Multi-frame state
  const [activeSN, setActiveSN] = useState(0); // index into snGroups
  const [activeFrameInGroup, setActiveFrameInGroup] = useState(0);
  const [showRawImage, setShowRawImage] = useState(false);

  // Parse ng_frame_details if present
  const frameDetails = useMemo(() => {
    if (!override) return null;
    const raw = override.ngFrameDetails || override.ng_frame_details;
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }, [override]);

  // Group frames by serial number
  const snGroups = useMemo(() => {
    if (!frameDetails) return [];
    const map = new Map();
    for (const frame of frameDetails) {
      const sn = frame.serialNumber || 'Unknown';
      if (!map.has(sn)) map.set(sn, []);
      map.get(sn).push(frame);
    }
    return Array.from(map.entries()).map(([sn, frames]) => ({ sn, frames }));
  }, [frameDetails]);

  // Cross-SN object dedup: when AI Backend sends ALL objects on every frame
  // (regardless of serial number), we distribute shared objects across SN groups
  // so each unique detection appears under only one SN tab.
  const dedupedSnGroups = useMemo(() => {
    if (snGroups.length <= 1) return snGroups

    // Build a map: objectKey -> Set of SN indices that contain it
    const keyToSNs = new Map()
    const keyToObj = new Map()
    snGroups.forEach((group, snIdx) => {
      for (const frame of group.frames) {
        for (const obj of (frame.objects || [])) {
          const key = `${obj.name}|${(obj.box || []).map(v => Math.round(v)).join(',')}`
          if (!keyToSNs.has(key)) keyToSNs.set(key, new Set())
          keyToSNs.get(key).add(snIdx)
          if (!keyToObj.has(key)) keyToObj.set(key, obj)
        }
      }
    })

    // Identify shared objects (appear in 2+ SN groups)
    const sharedKeys = []
    for (const [key, sns] of keyToSNs) {
      if (sns.size > 1) sharedKeys.push(key)
    }

    if (sharedKeys.length === 0) return snGroups

    // Sort shared objects by bounding box Y-center for spatial distribution.
    // This clusters nearby objects to the same SN (cavities at different positions).
    sharedKeys.sort((a, b) => {
      const boxA = keyToObj.get(a)?.box || [0, 0, 0, 0]
      const boxB = keyToObj.get(b)?.box || [0, 0, 0, 0]
      return ((boxA[1] + boxA[3]) / 2) - ((boxB[1] + boxB[3]) / 2)
    })

    // Split shared objects evenly across SN groups by spatial position
    const sharedAssignment = new Map()
    const n = snGroups.length
    sharedKeys.forEach((key, idx) => {
      const groupIdx = Math.min(Math.floor(idx / Math.ceil(sharedKeys.length / n)), n - 1)
      sharedAssignment.set(key, groupIdx)
    })

    // Build filtered groups with deduplicated objects
    return snGroups.map((group, snIdx) => ({
      ...group,
      frames: group.frames.map(frame => ({
        ...frame,
        objects: (frame.objects || []).filter(obj => {
          const key = `${obj.name}|${(obj.box || []).map(v => Math.round(v)).join(',')}`
          if (!sharedAssignment.has(key)) return true // unique to this SN
          return sharedAssignment.get(key) === snIdx   // shared: keep if assigned here
        })
      }))
    }))
  }, [snGroups])

  const isMultiFrame = dedupedSnGroups.length > 0;
  const currentGroup = dedupedSnGroups[activeSN] || null;
  const currentFrame = currentGroup?.frames[activeFrameInGroup] || null;

  if (!isOpen || !override) return null;

  // Build image URL from local path (legacy single-image)
  const getLegacyImageUrl = () => {
    const localPath = override.localImagePath || override.local_image_path;
    if (!localPath) return null;
    return `/api/storage/false-calls/${localPath}`;
  };

  // Build image URL for multi-frame (annotated or raw)
  const getFrameImageUrl = (frame) => {
    if (!frame) return null;
    const imgPath = showRawImage ? frame.imageRawPath : frame.imageAnnotatedPath;
    if (!imgPath) {
      return frame.imageAnnotatedPath ? `/api/storage/false-calls/${frame.imageAnnotatedPath}` : null;
    }
    return `/api/storage/false-calls/${imgPath}`;
  };

  const selectSN = (idx) => {
    setActiveSN(idx);
    setActiveFrameInGroup(0);
    setImageError(false);
    setShowRawImage(false);
  };

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
    setActiveSN(0);
    setActiveFrameInGroup(0);
    setShowRawImage(false);
    onClose();
  };

  const isReviewed = override.status !== 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={cn(
        "bg-panel rounded-xl shadow-2xl mx-4 overflow-hidden border border-surface-border",
        isMultiFrame ? "w-full max-w-[900px]" : "w-full max-w-[600px]"
      )}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-surface-border flex items-start justify-between bg-terminal">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-phosphor-amber/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-phosphor-amber" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-text-primary">
                {isReviewed ? t('manager.viewOverride') : t('manager.reviewOverride')}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-text-primary">{override.boardId}</span>
                <span>{override.operator || override.operatorName}</span>
                {isMultiFrame && (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-phosphor-cyan/20 text-phosphor-cyan text-xs font-mono">
                      {frameDetails.length} frames
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-mono">
                      {dedupedSnGroups.length} SN{dedupedSnGroups.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {isReviewed && (
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

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[68vh] overflow-y-auto">
          {error && (
            <div className="bg-phosphor-red/10 border border-phosphor-red/30 rounded-lg px-3 py-2">
              <p className="text-xs text-phosphor-red">{error}</p>
            </div>
          )}

          {isMultiFrame ? (
            /* ============ Multi-Frame View grouped by SN ============ */
            <>
              {/* SN selector tabs */}
              {dedupedSnGroups.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {dedupedSnGroups.map((group, idx) => (
                    <button
                      key={group.sn}
                      onClick={() => selectSN(idx)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono transition-all flex-shrink-0",
                        idx === activeSN
                          ? "border-phosphor-amber bg-phosphor-amber/10 text-phosphor-amber"
                          : "border-surface-border bg-elevated text-text-secondary hover:border-text-tertiary"
                      )}
                    >
                      <Hash className="w-3.5 h-3.5" />
                      {group.sn}
                      <span className="text-xs opacity-60">({group.frames.length})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Single SN header when only 1 */}
              {dedupedSnGroups.length === 1 && currentGroup && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-surface-border">
                  <Hash className="w-4 h-4 text-phosphor-amber" />
                  <span className="font-mono text-sm text-text-primary">{currentGroup.sn}</span>
                  <span className="text-xs text-text-tertiary font-mono">
                    {currentGroup.frames.length} false call frame{currentGroup.frames.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {currentGroup && (
                <>
                  {/* Frame thumbnails for current SN */}
                  {currentGroup.frames.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {currentGroup.frames.map((frame, idx) => (
                        <button
                          key={`${frame.side}-${frame.frameIndex}`}
                          onClick={() => { setActiveFrameInGroup(idx); setImageError(false) }}
                          className={cn(
                            "relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-all",
                            idx === activeFrameInGroup
                              ? "border-phosphor-amber ring-2 ring-phosphor-amber/30"
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
                          <div className="absolute bottom-0 inset-x-0 bg-void/80 text-center">
                            <span className="text-xxs font-mono text-text-primary">
                              {frame.side} F{frame.frameIndex}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main frame display */}
                  {currentFrame && (
                    <div className="space-y-3">
                      {/* Image with annotated/raw toggle */}
                      <div className="relative bg-void rounded-lg border border-surface-border overflow-hidden">
                        {/* Annotated/Raw toggle */}
                        <div className="absolute top-2 right-2 z-10 flex rounded-md border border-surface-border bg-void/80 backdrop-blur-sm overflow-hidden">
                          <button
                            onClick={() => setShowRawImage(false)}
                            className={cn(
                              "px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors",
                              !showRawImage ? "bg-phosphor-amber/20 text-phosphor-amber" : "text-text-tertiary hover:text-text-secondary"
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

                        {/* Nav arrows within SN group */}
                        {currentGroup.frames.length > 1 && (
                          <>
                            <button
                              onClick={() => { setActiveFrameInGroup(i => Math.max(0, i - 1)); setImageError(false) }}
                              disabled={activeFrameInGroup === 0}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-void/70 border border-surface-border text-text-secondary hover:text-phosphor-amber disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => { setActiveFrameInGroup(i => Math.min(currentGroup.frames.length - 1, i + 1)); setImageError(false) }}
                              disabled={activeFrameInGroup === currentGroup.frames.length - 1}
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-void/70 border border-surface-border text-text-secondary hover:text-phosphor-amber disabled:opacity-20 disabled:cursor-not-allowed transition-all"
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MetaCell label="Side" value={currentFrame.side} />
                        <MetaCell label="Frame" value={`F${currentFrame.frameIndex}`} />
                        <MetaCell label="Position" value={currentFrame.position ?? '-'} />
                        <MetaCell label="Reason" value={currentFrame.falseCallReason || '-'} highlight />
                      </div>

                      {/* Defect objects (deduplicated — AI may return overlapping bboxes) */}
                      {currentFrame.objects?.length > 0 && (() => {
                        const deduped = currentFrame.objects.filter((obj, i, arr) => {
                          for (let j = 0; j < i; j++) {
                            if (arr[j].name === obj.name && arr[j].box && obj.box &&
                              Math.abs(arr[j].box[0] - obj.box[0]) < 10 &&
                              Math.abs(arr[j].box[1] - obj.box[1]) < 10 &&
                              Math.abs(arr[j].box[2] - obj.box[2]) < 10 &&
                              Math.abs(arr[j].box[3] - obj.box[3]) < 10) return false
                          }
                          return true
                        })
                        return (
                        <div>
                          <h4 className="text-xs font-mono text-text-tertiary uppercase mb-1.5">
                            Detected Objects ({deduped.length})
                          </h4>
                          <div className="space-y-1">
                            {deduped.map((obj, i) => (
                              <div key={i} className="flex items-center gap-3 bg-elevated rounded px-3 py-1.5 border border-surface-border">
                                <span className="text-sm text-phosphor-red font-medium flex-shrink-0">{obj.name}</span>
                                <span className="text-xs text-text-tertiary font-mono">
                                  {obj.score != null ? `${(obj.score * 100).toFixed(1)}%` : '-'}
                                </span>
                                {obj.box && (
                                  <span className="text-xs text-text-tertiary font-mono ml-auto">
                                    [{obj.box.join(', ')}]
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        )
                      })()}
                    </div>
                  )}
                </>
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

          {/* Reason + Notes (shared between both views) */}
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

          {/* Reviewer Notes */}
          {isReviewed ? (
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
                className="w-full px-3 py-2 bg-elevated border border-surface-border rounded text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-amber resize-none disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-border flex items-center justify-end gap-3 bg-terminal">
          {isReviewed ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-elevated text-text-primary rounded-lg font-medium text-sm hover:bg-surface-border transition-colors"
            >
              {t('buttons.close')}
            </button>
          ) : (
            <>
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
            </>
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
      highlight ? "bg-phosphor-amber/5 border-phosphor-amber/20" : "bg-elevated border-surface-border"
    )}>
      <div className="text-xxs text-text-tertiary font-mono uppercase">{label}</div>
      <div className={cn(
        "text-sm font-mono truncate",
        highlight ? "text-phosphor-amber" : "text-text-primary"
      )}>{value}</div>
    </div>
  );
}

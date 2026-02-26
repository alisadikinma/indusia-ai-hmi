'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, FileText, CheckCircle, XCircle, ImageIcon, Eye, Layers, Hash, ChevronDown, ChevronUp, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { logOverrideApproved, logOverrideRejected } from '@/lib/eventLogger';
import { notifyOverrideApproved, notifyOverrideRejected } from '@/lib/notificationHelper';
import { authFetch } from '@/lib/utils/authFetch';
import ImageViewer from '@/components/common/ImageViewer';
import { getModelImage } from '@/lib/utils/modelImages';

/**
 * Helper: build a unique key for an object within a frame.
 * Format: "TOP-0-OBJ-2" (side-frameIndex-OBJ-objectIndex)
 */
function objKey(side, frameIndex, objectIndex) {
  return `${side}-${frameIndex}-OBJ-${objectIndex}`;
}

/**
 * Helper: flatten all objects across all frames into a single list
 * with their frame context attached.
 */
function flattenObjects(allFrames) {
  const result = [];
  allFrames.forEach((frame) => {
    (frame.objects || []).forEach((obj, objIdx) => {
      result.push({
        ...obj,
        frameSide: frame.side,
        frameIndex: frame.frameIndex,
        objectIndex: objIdx,
        serialNumber: frame.serialNumber,
        imageAnnotatedPath: frame.imageAnnotatedPath,
        imageRawPath: frame.imageRawPath,
        position: frame.position,
        falseCallReason: frame.falseCallReason,
        key: objKey(frame.side, frame.frameIndex, objIdx),
      });
    });
  });
  return result;
}

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
  const [showRawImage, setShowRawImage] = useState(false);

  // Per-object review state
  const [objectDecisions, setObjectDecisions] = useState({});
  const [activeObjectKey, setActiveObjectKey] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // Appeal state
  const [appealingKey, setAppealingKey] = useState(null); // object key being appealed
  const [appealReason, setAppealReason] = useState('');
  const [appealProcessing, setAppealProcessing] = useState(false);
  const [appealDecisions, setAppealDecisions] = useState({}); // parsed from override

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

  // Flat list of all objects across all frames
  const allObjects = useMemo(() => flattenObjects(allFrames), [allFrames]);
  const isMultiObject = allObjects.length > 0;
  const totalObjects = allObjects.length;

  // The currently active (selected) object
  const activeObject = useMemo(
    () => allObjects.find(o => o.key === activeObjectKey) || allObjects[0] || null,
    [allObjects, activeObjectKey]
  );

  // Frame that contains the active object (for image display)
  const activeFrame = useMemo(() => {
    if (!activeObject) return null;
    return allFrames.find(
      f => f.side === activeObject.frameSide && f.frameIndex === activeObject.frameIndex
    );
  }, [activeObject, allFrames]);

  // Objects in the active frame (for ImageViewer bbox overlay)
  const activeFrameObjects = useMemo(() => {
    if (!activeFrame) return [];
    return (activeFrame.objects || []).map((obj, idx) => ({
      name: obj.name,
      box: obj.box,
      score: obj.score,
      label: obj.label,
      _key: objKey(activeFrame.side, activeFrame.frameIndex, idx),
    }));
  }, [activeFrame]);

  // Index of the active object within its frame's objects (for ImageViewer highlight)
  const activeObjectFrameIndex = useMemo(() => {
    if (!activeObject || !activeFrame) return -1;
    return activeObject.objectIndex;
  }, [activeObject, activeFrame]);

  // Group objects by serial number for the object list sidebar
  const objectsBySn = useMemo(() => {
    const groups = {};
    allObjects.forEach(obj => {
      const sn = obj.serialNumber || `PCB-${obj.frameIndex + 1}`;
      if (!groups[sn]) groups[sn] = [];
      groups[sn].push(obj);
    });
    return groups;
  }, [allObjects]);

  const snList = useMemo(() => Object.keys(objectsBySn), [objectsBySn]);

  // Load existing object/frame decisions for read-only view
  const existingDecisions = useMemo(() => {
    if (!override) return null;
    // Check for per-object decisions first, then fall back to per-frame
    const raw = override.objectDecisions || override.object_decisions ||
                override.frameDecisions || override.frame_decisions;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }, [override]);

  const isAlreadyReviewed = override?.status === 'reviewed' || override?.status === 'approved' || override?.status === 'rejected' || override?.status === 'appealed';
  const isPending = override?.status === 'pending';
  const canAppeal = override?.status === 'reviewed' || override?.status === 'appealed';

  // Reset state when override changes
  useEffect(() => {
    if (!override) return;
    setReviewerNotes('');
    setError(null);
    setShowRawImage(false);
    setShowSummary(false);
    setIsProcessing(false);
    setActiveObjectKey(null);
    setAppealingKey(null);
    setAppealReason('');
    setAppealProcessing(false);
    // Load existing decisions or start fresh
    if (existingDecisions) {
      setObjectDecisions(existingDecisions);
    } else {
      setObjectDecisions({});
    }
    // Load appeal decisions
    const rawAppeals = override.appealDecisions || override.appeal_decisions;
    if (rawAppeals) {
      setAppealDecisions(typeof rawAppeals === 'string' ? JSON.parse(rawAppeals) : rawAppeals);
    } else {
      setAppealDecisions({});
    }
  }, [override?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first object when allObjects load
  useEffect(() => {
    if (allObjects.length > 0 && !activeObjectKey) {
      setActiveObjectKey(allObjects[0].key);
    }
  }, [allObjects, activeObjectKey]);

  // Count decisions
  const reviewedCount = Object.keys(objectDecisions).length;
  const approvedCount = Object.values(objectDecisions).filter(d => d === 'approved').length;
  const rejectedCount = Object.values(objectDecisions).filter(d => d === 'rejected').length;
  const allReviewed = isMultiObject && reviewedCount === totalObjects;

  // Per-object decision handler
  const handleObjectDecision = useCallback((key, decision) => {
    if (isAlreadyReviewed) return;
    setObjectDecisions(prev => ({ ...prev, [key]: decision }));
  }, [isAlreadyReviewed]);

  // Appeal handler — submit appeal for a specific object
  const handleAppealSubmit = async () => {
    if (!appealingKey || !appealReason.trim() || appealProcessing) return;
    setAppealProcessing(true);
    setError(null);
    try {
      const res = await authFetch(`/api/overrides/${override.id}/appeal`, {
        method: 'POST',
        body: JSON.stringify({
          objectKey: appealingKey,
          reason: appealReason.trim(),
          appealedBy: user?.id,
          appealedByName: user?.name,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to submit appeal');

      // Update local appeal state
      setAppealDecisions(prev => ({
        ...prev,
        [appealingKey]: {
          status: 'appealed',
          reason: appealReason.trim(),
          appealedBy: user?.id,
          appealedByName: user?.name,
          appealedAt: new Date().toISOString(),
        }
      }));
      setAppealingKey(null);
      setAppealReason('');
    } catch (err) {
      console.error('Failed to submit appeal:', err);
      setError(err.message || 'Failed to submit appeal');
    } finally {
      setAppealProcessing(false);
    }
  };

  // Submit all object decisions
  const handleSubmitReview = async () => {
    if (!onReview || !allReviewed) return;
    setIsProcessing(true);
    setError(null);
    try {
      await onReview(override.id, objectDecisions, reviewerNotes);
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
    setShowRawImage(false);
    setObjectDecisions({});
    setActiveObjectKey(null);
    setShowSummary(false);
    onClose();
  };

  // Resolve model name from override (stored during creation) or from override data
  const overrideModelName = override?.modelName || override?.model_name || null;

  // Build image URL for a frame — prefer static PCB image when model is mapped
  const getFrameImageUrl = (frame) => {
    if (!frame) return null;
    // Try static image first (bboxes from objects overlay on the raw PCB image)
    const staticImg = getModelImage(overrideModelName, frame.side);
    if (staticImg) return staticImg;
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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !isMultiObject || !isPending || showSummary) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (activeObject) handleObjectDecision(activeObject.key, 'approved');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (activeObject) handleObjectDecision(activeObject.key, 'rejected');
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = allObjects.findIndex(o => o.key === activeObjectKey);
        if (idx < allObjects.length - 1) {
          setActiveObjectKey(allObjects[idx + 1].key);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = allObjects.findIndex(o => o.key === activeObjectKey);
        if (idx > 0) {
          setActiveObjectKey(allObjects[idx - 1].key);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMultiObject, isPending, showSummary, activeObject, activeObjectKey, allObjects, handleObjectDecision]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !override) return null;

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={cn(
        "bg-panel rounded-xl shadow-2xl mx-4 overflow-hidden border border-surface-border flex flex-col",
        isMultiObject ? "w-full max-w-[1200px] max-h-[92vh]" : "w-full max-w-[600px]"
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
                {isMultiObject && !showSummary && (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal text-xs font-mono font-bold">
                      {totalObjects} object{totalObjects !== 1 ? 's' : ''} &middot; {allFrames.length} frame{allFrames.length !== 1 ? 's' : ''}
                    </span>
                    {reviewedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-phosphor-cyan/20 text-phosphor-cyan text-xs font-mono">
                        {reviewedCount}/{totalObjects} reviewed
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
        <div className="flex-1 overflow-hidden min-h-0">
          {error && (
            <div className="mx-5 mt-3 bg-phosphor-red/10 border border-phosphor-red/30 rounded-lg px-3 py-2">
              <p className="text-xs text-phosphor-red">{error}</p>
            </div>
          )}

          {isMultiObject && showSummary ? (
            /* ============ Summary View ============ */
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(92vh-160px)]">
              <SummaryView
                objectsBySn={objectsBySn}
                snList={snList}
                objectDecisions={objectDecisions}
                onClickObject={(key) => { setShowSummary(false); setActiveObjectKey(key); }}
                t={t}
              />
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

          ) : isMultiObject ? (
            /* ============ Per-Object Review — Split Layout ============ */
            <div className="flex h-full" style={{ height: 'calc(92vh - 160px)' }}>
              {/* Left Panel — Image Viewer */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-surface-border">
                {/* AI/RAW toggle */}
                <div className="flex items-center gap-1 px-3 py-2 bg-terminal border-b border-surface-border shrink-0">
                  <button
                    onClick={() => setShowRawImage(false)}
                    className={cn(
                      "px-2 py-1 text-xs font-mono flex items-center gap-1 rounded transition-colors",
                      !showRawImage ? "bg-phosphor-teal/20 text-phosphor-teal" : "text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <Layers className="w-3 h-3" />
                    AI
                  </button>
                  <button
                    onClick={() => setShowRawImage(true)}
                    disabled={!activeFrame?.imageRawPath}
                    className={cn(
                      "px-2 py-1 text-xs font-mono flex items-center gap-1 rounded transition-colors",
                      showRawImage ? "bg-phosphor-cyan/20 text-phosphor-cyan" : "text-text-tertiary hover:text-text-secondary",
                      !activeFrame?.imageRawPath && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    RAW
                  </button>
                  {activeFrame && (
                    <span className="ml-auto text-xxs font-mono text-text-tertiary">
                      {activeFrame.side} F{activeFrame.frameIndex}
                    </span>
                  )}
                </div>

                {/* Image with bbox overlays */}
                <div className="flex-1 min-h-0">
                  {getFrameImageUrl(activeFrame) ? (
                    <ImageViewer
                      src={getFrameImageUrl(activeFrame)}
                      alt={`${activeFrame?.side} frame ${activeFrame?.frameIndex}`}
                      objects={activeFrameObjects}
                      activeObjectIndex={activeObjectFrameIndex}
                      onObjectClick={(idx) => {
                        const obj = activeFrameObjects[idx];
                        if (obj?._key) setActiveObjectKey(obj._key);
                      }}
                      className="w-full h-full"
                      showControls={true}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary bg-void">
                      <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-xs">{t('manager.noImageAvailable')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel — Object List */}
              <div className="w-80 flex flex-col shrink-0 bg-terminal overflow-hidden">
                {/* Panel header */}
                <div className="px-3 py-2 border-b border-surface-border shrink-0">
                  <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-wide">
                    Detected Objects ({totalObjects})
                  </h3>
                  {isPending && (
                    <p className="text-xxs text-text-tertiary mt-0.5">
                      Press <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-green font-mono">A</kbd> approve &middot; <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-red font-mono">R</kbd> reject &middot; <kbd className="px-1 py-0.5 bg-elevated rounded font-mono">&darr;&uarr;</kbd> navigate
                    </p>
                  )}
                </div>

                {/* Scrollable object list grouped by SN */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {snList.map(sn => (
                    <SnGroup
                      key={sn}
                      sn={sn}
                      objects={objectsBySn[sn]}
                      objectDecisions={objectDecisions}
                      activeObjectKey={activeObjectKey}
                      isPending={isPending}
                      canAppeal={canAppeal}
                      appealDecisions={appealDecisions}
                      appealingKey={appealingKey}
                      appealReason={appealReason}
                      appealProcessing={appealProcessing}
                      onSelectObject={setActiveObjectKey}
                      onDecision={handleObjectDecision}
                      onStartAppeal={(key) => { setAppealingKey(key); setAppealReason(''); }}
                      onCancelAppeal={() => { setAppealingKey(null); setAppealReason(''); }}
                      onAppealReasonChange={setAppealReason}
                      onSubmitAppeal={handleAppealSubmit}
                    />
                  ))}
                </div>

                {/* Reason + operator notes */}
                <div className="px-3 py-2 border-t border-surface-border shrink-0 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xxs text-text-tertiary font-mono uppercase">Reason</span>
                      <p className="text-xs text-text-primary truncate">{override.reason || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xxs text-text-tertiary font-mono uppercase">Notes</span>
                      <p className="text-xs text-text-primary truncate">
                        {override.operatorNotes || override.operator_notes || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* ============ Legacy Single-Image View ============ */
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(92vh-160px)]">
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wide">
                  {t('manager.aiDetection')}
                </h3>
                <div className="bg-void rounded-lg border border-surface-border overflow-hidden">
                  {getLegacyImageUrl() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getLegacyImageUrl()}
                      alt="False call image"
                      className="w-full h-40 object-contain bg-black"
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

              {/* Reason + Notes */}
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
              {isAlreadyReviewed ? (
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
              )}
            </div>
          )}
        </div>

        {/* ============ Footer ============ */}
        <div className="px-5 py-3 border-t border-surface-border flex items-center justify-between gap-3 bg-terminal shrink-0">
          {isMultiObject && showSummary && isPending ? (
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
                    Submit Review
                  </>
                )}
              </button>
            </>

          ) : isMultiObject && isPending ? (
            /* Per-object footer: progress + submit */
            <>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary font-mono">
                  {reviewedCount}/{totalObjects} reviewed
                </span>
                {approvedCount > 0 && (
                  <span className="text-xs font-mono text-phosphor-green">{approvedCount} approved</span>
                )}
                {rejectedCount > 0 && (
                  <span className="text-xs font-mono text-phosphor-red">{rejectedCount} rejected</span>
                )}
              </div>
              {allReviewed ? (
                <button
                  onClick={() => setShowSummary(true)}
                  className="px-5 py-2 bg-phosphor-teal text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-teal-bright transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Review Summary
                </button>
              ) : (
                <span className="text-xs text-text-tertiary font-mono">
                  Review all objects to submit
                </span>
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

// ====================================================================
// Sub-components
// ====================================================================

/** SN Group — collapsible group of objects sharing the same serial number */
function SnGroup({
  sn, objects, objectDecisions, activeObjectKey, isPending,
  canAppeal, appealDecisions, appealingKey, appealReason, appealProcessing,
  onSelectObject, onDecision,
  onStartAppeal, onCancelAppeal, onAppealReasonChange, onSubmitAppeal,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const decidedCount = objects.filter(o => objectDecisions[o.key] != null).length;
  const allDecided = decidedCount === objects.length;
  const hasRejection = objects.some(o => objectDecisions[o.key] === 'rejected');

  return (
    <div className="border-b border-surface-border">
      {/* SN header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-elevated/50 transition-colors",
          allDecided
            ? hasRejection ? "bg-phosphor-red/5" : "bg-phosphor-green/5"
            : ""
        )}
      >
        <Hash className="w-3 h-3 text-text-tertiary shrink-0" />
        <span className="font-mono text-xs font-medium text-text-primary truncate flex-1">{sn}</span>
        <span className="text-xxs text-text-tertiary font-mono shrink-0">{decidedCount}/{objects.length}</span>
        {allDecided && (
          <span className={cn(
            "w-4 h-4 shrink-0",
            hasRejection ? "text-phosphor-red" : "text-phosphor-green"
          )}>
            {hasRejection ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </span>
        )}
        {collapsed ? <ChevronDown className="w-3 h-3 text-text-tertiary shrink-0" /> : <ChevronUp className="w-3 h-3 text-text-tertiary shrink-0" />}
      </button>

      {/* Object rows */}
      {!collapsed && objects.map(obj => {
        const isActive = obj.key === activeObjectKey;
        const decision = objectDecisions[obj.key];
        const hasDecision = decision != null;
        const appeal = appealDecisions?.[obj.key];
        const isAppealed = appeal?.status === 'appealed';
        const isAppealResolved = appeal?.status === 're_approved' || appeal?.status === 're_rejected';
        const isAppealingThis = appealingKey === obj.key;
        const alreadyAppealed = !!appeal;

        return (
          <div key={obj.key}>
            <div
              onClick={() => onSelectObject(obj.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border-l-2",
                isActive
                  ? "bg-phosphor-teal/10 border-l-phosphor-teal"
                  : isAppealed
                    ? "bg-yellow-500/5 border-l-yellow-500/50"
                    : hasDecision
                      ? decision === 'approved'
                        ? "bg-phosphor-green/5 border-l-phosphor-green/50 hover:bg-phosphor-green/10"
                        : "bg-phosphor-red/5 border-l-phosphor-red/50 hover:bg-phosphor-red/10"
                      : "border-l-transparent hover:bg-elevated/50"
              )}
            >
              {/* Object info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {/* Label color dot */}
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    (obj.label === 1 || obj.label === true) ? "bg-phosphor-red" : "bg-phosphor-green"
                  )} />
                  <span className={cn(
                    "text-xs font-medium truncate",
                    isActive ? "text-phosphor-teal" : "text-text-primary"
                  )}>
                    {obj.name}
                  </span>
                  <span className="text-xxs text-text-tertiary font-mono shrink-0">
                    {obj.score != null ? `${(obj.score * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
                {obj.box && obj.box.length >= 4 && (
                  <span className="text-[9px] text-text-tertiary/60 font-mono block ml-3">
                    [{Math.round(obj.box[0])}, {Math.round(obj.box[1])}, {Math.round(obj.box[2])}, {Math.round(obj.box[3])}]
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xxs text-text-tertiary font-mono">
                    {obj.frameSide} F{obj.frameIndex}
                  </span>
                  {isAppealed && (
                    <span className="text-xxs font-mono text-yellow-400 flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Appealed
                    </span>
                  )}
                  {isAppealResolved && (
                    <span className={cn(
                      "text-xxs font-mono flex items-center gap-0.5",
                      appeal.status === 're_approved' ? "text-phosphor-green" : "text-phosphor-red"
                    )}>
                      {appeal.status === 're_approved' ? 'Re-approved' : 'Re-rejected'}
                    </span>
                  )}
                </div>
              </div>

              {/* Approve/Reject buttons (pending) or status badge + appeal button (reviewed) */}
              {isPending ? (
                <div className="flex items-center rounded overflow-hidden border border-surface-border shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDecision(obj.key, 'approved'); }}
                    className={cn(
                      "px-1.5 py-0.5 transition-all",
                      decision === 'approved'
                        ? "bg-phosphor-green/20 text-phosphor-green"
                        : "text-text-tertiary hover:text-phosphor-green hover:bg-phosphor-green/5"
                    )}
                    title="Approve (A)"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-surface-border" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDecision(obj.key, 'rejected'); }}
                    className={cn(
                      "px-1.5 py-0.5 transition-all",
                      decision === 'rejected'
                        ? "bg-phosphor-red/20 text-phosphor-red"
                        : "text-text-tertiary hover:text-phosphor-red hover:bg-phosphor-red/5"
                    )}
                    title="Reject (R)"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  {hasDecision && (
                    <span className={cn(
                      "text-xxs font-mono font-medium px-1.5 py-0.5 rounded",
                      decision === 'approved' ? "bg-phosphor-green/15 text-phosphor-green" : "bg-phosphor-red/15 text-phosphor-red"
                    )}>
                      {decision === 'approved' ? 'OK' : 'NG'}
                    </span>
                  )}
                  {/* Appeal button — only for reviewed overrides, 1x per object */}
                  {canAppeal && hasDecision && !alreadyAppealed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartAppeal(obj.key); }}
                      className="px-1.5 py-0.5 text-xxs font-mono text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                      title="Appeal this decision"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inline appeal form */}
            {isAppealingThis && (
              <div className="px-3 py-2 bg-yellow-500/5 border-l-2 border-l-yellow-500/50 space-y-1.5">
                <p className="text-xxs text-yellow-400 font-mono">Appeal reason (required):</p>
                <textarea
                  value={appealReason}
                  onChange={(e) => onAppealReasonChange(e.target.value)}
                  placeholder="Explain why this decision should be re-reviewed..."
                  rows={2}
                  className="w-full px-2 py-1.5 bg-elevated border border-surface-border rounded text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelAppeal(); }}
                    className="px-2 py-1 text-xxs text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSubmitAppeal(); }}
                    disabled={!appealReason.trim() || appealProcessing}
                    className="px-2 py-1 text-xxs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {appealProcessing && <div className="w-2.5 h-2.5 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />}
                    Submit Appeal
                  </button>
                </div>
              </div>
            )}

            {/* Show existing appeal info */}
            {appeal && !isAppealingThis && (
              <div className="px-3 py-1 bg-yellow-500/5 border-l-2 border-l-yellow-500/30">
                <p className="text-xxs text-yellow-400/70 font-mono truncate" title={appeal.reason}>
                  Appeal: &quot;{appeal.reason}&quot;
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Summary View — shows review decisions grouped by SN */
function SummaryView({ objectsBySn, snList, objectDecisions, onClickObject, t }) {
  // Count PCB-level verdicts
  const pcbNgCount = snList.filter(sn => {
    const objs = objectsBySn[sn];
    return objs.some(o => objectDecisions[o.key] === 'rejected');
  }).length;
  const pcbOkCount = snList.length - pcbNgCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-display font-bold text-text-primary">
          Review Summary
        </h3>
        <div className="flex items-center gap-3">
          {pcbOkCount > 0 && (
            <span className="text-xs font-mono text-phosphor-green">{pcbOkCount} PCB OK</span>
          )}
          {pcbNgCount > 0 && (
            <span className="text-xs font-mono text-phosphor-red">{pcbNgCount} PCB NG</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {snList.map(sn => {
          const objs = objectsBySn[sn];
          const hasRejection = objs.some(o => objectDecisions[o.key] === 'rejected');

          return (
            <div key={sn} className={cn(
              "rounded-lg border overflow-hidden",
              hasRejection ? "border-phosphor-red/40" : "border-phosphor-green/40"
            )}>
              <div className={cn(
                "flex items-center justify-between px-3 py-1.5",
                hasRejection ? "bg-phosphor-red/5" : "bg-phosphor-green/5"
              )}>
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3 text-text-tertiary" />
                  <span className="font-mono text-xs font-medium text-text-primary">{sn}</span>
                  <span className="text-xxs text-text-tertiary font-mono">
                    {objs.length} object{objs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold",
                  hasRejection ? "bg-phosphor-red/20 text-phosphor-red" : "bg-phosphor-green/20 text-phosphor-green"
                )}>
                  {hasRejection ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  {hasRejection ? 'NG' : 'OK'}
                </span>
              </div>
              <div className="divide-y divide-surface-border">
                {objs.map(obj => {
                  const decision = objectDecisions[obj.key];
                  return (
                    <button
                      key={obj.key}
                      onClick={() => onClickObject(obj.key)}
                      className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-elevated/50 transition-colors text-left"
                    >
                      <span className="text-xs font-mono text-text-secondary flex-1 truncate">
                        {obj.name}
                        <span className="text-text-tertiary ml-1.5">
                          {obj.frameSide} F{obj.frameIndex}
                        </span>
                      </span>
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-mono shrink-0",
                        decision === 'approved' ? "text-phosphor-green" : "text-phosphor-red"
                      )}>
                        {decision === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {decision === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

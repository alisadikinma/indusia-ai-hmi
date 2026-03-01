'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, CheckCircle, XCircle, ImageIcon, Eye, Layers, ChevronDown, MessageSquare, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { logOverrideApproved, logOverrideRejected } from '@/lib/eventLogger';
import { notifyOverrideApproved, notifyOverrideRejected } from '@/lib/notificationHelper';
import { authFetch } from '@/lib/utils/authFetch';
import ImageViewer from '@/components/common/ImageViewer';
import { normalizeBox } from '@/lib/utils/inspectionReview';

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

/** Format a timestamp string into a compact display format */
function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
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
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Bulk selection state
  const [bulkSelected, setBulkSelected] = useState(() => new Set());

  // Appeal state
  const [appealingKey, setAppealingKey] = useState(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealProcessing, setAppealProcessing] = useState(false);
  const [appealDecisions, setAppealDecisions] = useState({});

  // History collapsed state
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

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

  // Group objects by serial number (kept for SummaryView)
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
    const raw = override.objectDecisions || override.object_decisions ||
                override.frameDecisions || override.frame_decisions;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }, [override]);

  const isAlreadyReviewed = override?.status === 'reviewed' || override?.status === 'approved' || override?.status === 'rejected' || override?.status === 'appealed';
  const isPending = override?.status === 'pending';
  const canAppeal = override?.status === 'reviewed' || override?.status === 'appealed';

  // Select object + trigger ImageViewer zoom (toggle: click same → deselect + reset)
  const handleSelectObject = useCallback((key) => {
    if (key === activeObjectKey) {
      setActiveObjectKey(null);
      return;
    }
    setActiveObjectKey(key);
    setFocusTrigger(prev => prev + 1);
  }, [activeObjectKey]);

  // Reset state when override changes
  useEffect(() => {
    if (!override) return;
    setReviewerNotes('');
    setError(null);
    setShowRawImage(false);
    setShowSummary(false);
    setIsProcessing(false);
    setActiveObjectKey(null);
    setFocusTrigger(0);
    setAppealingKey(null);
    setAppealReason('');
    setAppealProcessing(false);
    setBulkSelected(new Set());
    setHistoryCollapsed(!isAlreadyReviewed);
    if (existingDecisions) {
      setObjectDecisions(existingDecisions);
    } else {
      setObjectDecisions({});
    }
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

  // Unreviewed objects (for bulk selection)
  const unreviewed = useMemo(
    () => allObjects.filter(o => objectDecisions[o.key] == null),
    [allObjects, objectDecisions]
  );
  const unreviewedCount = unreviewed.length;

  // Effective bulk selection — only unreviewed items
  const effectiveBulkSelected = useMemo(() => {
    const unreviewedKeys = new Set(unreviewed.map(o => o.key));
    return new Set([...bulkSelected].filter(k => unreviewedKeys.has(k)));
  }, [bulkSelected, unreviewed]);
  const bulkSelectedCount = effectiveBulkSelected.size;

  // Bulk selection handlers
  const toggleBulkSelect = useCallback((key) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (effectiveBulkSelected.size === unreviewed.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(unreviewed.map(o => o.key)));
    }
  }, [effectiveBulkSelected.size, unreviewed]);

  const handleBulkApprove = useCallback(() => {
    const newDecisions = { ...objectDecisions };
    for (const obj of unreviewed) {
      if (!effectiveBulkSelected.has(obj.key)) continue;
      newDecisions[obj.key] = 'approved';
    }
    setObjectDecisions(newDecisions);
    setBulkSelected(new Set());
  }, [objectDecisions, unreviewed, effectiveBulkSelected]);

  const handleBulkReject = useCallback(() => {
    const newDecisions = { ...objectDecisions };
    for (const obj of unreviewed) {
      if (!effectiveBulkSelected.has(obj.key)) continue;
      newDecisions[obj.key] = 'rejected';
    }
    setObjectDecisions(newDecisions);
    setBulkSelected(new Set());
  }, [objectDecisions, unreviewed, effectiveBulkSelected]);

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

  // Legacy single-decision handlers
  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onApprove(override.id, reviewerNotes);
      logOverrideApproved(user?.id, { overrideId: override.id, boardId: override.boardId, notes: reviewerNotes });
      notifyOverrideApproved(override.operatorId || override.operator_id, { boardId: override.boardId });
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
      logOverrideRejected(user?.id, { overrideId: override.id, boardId: override.boardId, notes: reviewerNotes });
      notifyOverrideRejected(override.operatorId || override.operator_id, { boardId: override.boardId }, reviewerNotes);
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
    setBulkSelected(new Set());
    onClose();
  };

  // Build image URL for a frame
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

  // Build review history timeline entries
  const historyEntries = useMemo(() => {
    if (!override) return [];
    const entries = [];
    // 1. Created
    entries.push({
      type: 'created',
      who: override.operatorName || override.operator_name || 'Operator',
      when: override.createdAt || override.created_at,
      text: `Submitted false call: ${override.reason || 'UNSPECIFIED'}`,
    });
    // 2. Reviewed
    const reviewedAt = override.reviewedAt || override.reviewed_at;
    if (reviewedAt) {
      const reviewerName = override.reviewerName || override.reviewer_name || 'Manager';
      const notes = override.reviewNotes || override.review_notes;
      entries.push({
        type: 'reviewed',
        who: reviewerName,
        when: reviewedAt,
        text: `Reviewed: ${approvedCount} approved, ${rejectedCount} rejected${notes ? ` — "${notes}"` : ''}`,
      });
    }
    // 3. Appeals
    for (const [key, appeal] of Object.entries(appealDecisions)) {
      if (appeal.appealedAt) {
        entries.push({
          type: 'appealed',
          who: appeal.appealedByName || 'Manager',
          when: appeal.appealedAt,
          text: `Appealed ${key}: "${appeal.reason}"`,
        });
      }
      if (appeal.decidedAt) {
        entries.push({
          type: appeal.status === 're_approved' ? 'appeal_approved' : 'appeal_rejected',
          who: appeal.decidedByName || 'Manager',
          when: appeal.decidedAt,
          text: `${appeal.status === 're_approved' ? 'Re-approved' : 'Re-rejected'} ${key}${appeal.decisionReason ? `: "${appeal.decisionReason}"` : ''}`,
        });
      }
    }
    // Sort by time
    entries.sort((a, b) => new Date(a.when || 0) - new Date(b.when || 0));
    return entries;
  }, [override, approvedCount, rejectedCount, appealDecisions]);

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
        if (idx < allObjects.length - 1) handleSelectObject(allObjects[idx + 1].key);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = allObjects.findIndex(o => o.key === activeObjectKey);
        if (idx > 0) handleSelectObject(allObjects[idx - 1].key);
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
    <div className="fixed inset-0 z-50 flex flex-col bg-panel">
      {/* ============ Header ============ */}
      <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between bg-terminal shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-display font-bold text-text-primary">
                {isAlreadyReviewed ? t('manager.viewOverride') : t('manager.reviewOverride')}
              </h2>
              <span className="text-xs font-mono text-phosphor-teal">{override.boardId}</span>
              <span className="text-xs text-text-secondary">{override.operator || override.operatorName}</span>
              {isMultiObject && (
                <span className="px-1.5 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal text-xs font-mono font-bold">
                  {totalObjects} objects &middot; {allFrames.length} frames
                </span>
              )}
              {isAlreadyReviewed && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  override.status === 'approved' ? "bg-phosphor-green/20 text-phosphor-green"
                    : override.status === 'rejected' ? "bg-phosphor-red/20 text-phosphor-red"
                    : override.status === 'appealed' ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-phosphor-cyan/20 text-phosphor-cyan"
                )}>
                  {override.status.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleClose} disabled={isProcessing}
          className="p-2 rounded bg-elevated border border-surface-border hover:border-phosphor-teal/50 transition-colors disabled:opacity-50">
          <X className="w-5 h-5 text-text-tertiary" />
        </button>
      </div>

      {/* ============ Error bar ============ */}
      {error && (
        <div className="mx-4 mt-2 bg-phosphor-red/10 border border-phosphor-red/30 rounded-lg px-3 py-2 shrink-0">
          <p className="text-xs text-phosphor-red">{error}</p>
        </div>
      )}

      {/* ============ Main content ============ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {isMultiObject && showSummary ? (
          /* ============ Summary View ============ */
          <div className="flex-1 flex flex-col items-center overflow-y-auto py-6 px-4">
            <div className="w-full max-w-2xl space-y-4">
              <SummaryView
                objectsBySn={objectsBySn}
                snList={snList}
                objectDecisions={objectDecisions}
                onClickObject={(key) => { setShowSummary(false); handleSelectObject(key); }}
                t={t}
              />
              {isPending && (
                <div className="space-y-3">
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
                  <div className="flex items-center justify-between">
                    <button onClick={() => setShowSummary(false)}
                      className="px-4 py-2 bg-elevated text-text-primary rounded-lg font-medium text-sm hover:bg-surface-border transition-colors">
                      Back to Review
                    </button>
                    <button onClick={handleSubmitReview} disabled={isProcessing || !allReviewed}
                      className="px-6 py-2 bg-phosphor-teal text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-teal-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                      {isProcessing ? (
                        <><div className="w-3.5 h-3.5 border-2 border-void/30 border-t-void rounded-full animate-spin" />{t('manager.processing')}</>
                      ) : (
                        <><CheckCircle className="w-4 h-4" />Submit Review</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        ) : isMultiObject ? (
          /* ============ Per-Object Review — Fullscreen Split Layout ============ */
          <>
            {/* Left — Image Viewer */}
            <div className="flex-1 relative min-w-0 min-h-0 flex flex-col">
              {/* AI/RAW toggle bar */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-terminal border-b border-surface-border shrink-0">
                <button onClick={() => setShowRawImage(false)}
                  className={cn("px-2 py-1 text-xs font-mono flex items-center gap-1 rounded transition-colors",
                    !showRawImage ? "bg-phosphor-teal/20 text-phosphor-teal" : "text-text-tertiary hover:text-text-secondary")}>
                  <Layers className="w-3 h-3" />AI
                </button>
                <button onClick={() => setShowRawImage(true)} disabled={!activeFrame?.imageRawPath}
                  className={cn("px-2 py-1 text-xs font-mono flex items-center gap-1 rounded transition-colors",
                    showRawImage ? "bg-phosphor-cyan/20 text-phosphor-cyan" : "text-text-tertiary hover:text-text-secondary",
                    !activeFrame?.imageRawPath && "opacity-30 cursor-not-allowed")}>
                  <Eye className="w-3 h-3" />RAW
                </button>
                {activeFrame && (
                  <span className="ml-auto text-xxs font-mono text-text-tertiary">
                    {activeFrame.side} F{activeFrame.frameIndex}
                  </span>
                )}
              </div>

              {/* Image area */}
              <div className="flex-1 relative min-h-0">
                {getFrameImageUrl(activeFrame) ? (
                  <ImageViewer
                    src={getFrameImageUrl(activeFrame)}
                    alt={`${activeFrame?.side} frame ${activeFrame?.frameIndex}`}
                    objects={activeFrameObjects}
                    activeObjectIndex={activeObjectFrameIndex}
                    focusTrigger={focusTrigger}
                    className="w-full h-full"
                    showControls={true}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary bg-void">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-xs">{t('manager.noImageAvailable')}</p>
                  </div>
                )}

                {/* Thumbnail strip — overlaid at bottom */}
                {allFrames.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-void/80 backdrop-blur-sm border border-surface-border/50">
                    {allFrames.map((frame) => {
                      const isActive = activeFrame?.side === frame.side && activeFrame?.frameIndex === frame.frameIndex;
                      const frameImgUrl = frame.imageAnnotatedPath
                        ? `/api/storage/false-calls/${frame.imageAnnotatedPath}`
                        : null;
                      return (
                        <button key={`${frame.side}-${frame.frameIndex}`}
                          onClick={() => {
                            // Find first object in this frame
                            const obj = allObjects.find(o => o.frameSide === frame.side && o.frameIndex === frame.frameIndex);
                            if (obj) handleSelectObject(obj.key);
                          }}
                          className={cn(
                            "relative flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all",
                            isActive ? "border-phosphor-teal ring-1 ring-phosphor-teal/40" : "border-surface-border hover:border-phosphor-teal/50"
                          )}>
                          {frameImgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={frameImgUrl} alt={`${frame.side} F${frame.frameIndex}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-void flex items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-text-tertiary" />
                            </div>
                          )}
                          <span className="absolute top-0 left-0 px-1 text-[9px] font-mono font-bold bg-void/80 text-text-primary rounded-br leading-tight">
                            {frame.side === 'TOP' ? 'TOP' : 'BTM'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right — Object list panel */}
            <div className="w-80 flex flex-col shrink-0 bg-terminal border-l border-surface-border overflow-hidden">
              {/* Panel header */}
              <div className="px-3 py-2 border-b border-surface-border shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-wide">
                    Objects ({totalObjects})
                  </h3>
                  <div className="flex items-center gap-2">
                    {approvedCount > 0 && <span className="text-xxs font-mono text-phosphor-green">{approvedCount} OK</span>}
                    {rejectedCount > 0 && <span className="text-xxs font-mono text-phosphor-red">{rejectedCount} NG</span>}
                    {reviewedCount > 0 && (
                      <span className="text-xxs font-mono text-phosphor-teal">{reviewedCount}/{totalObjects}</span>
                    )}
                  </div>
                </div>
                {isPending && (
                  <p className="text-xxs text-text-tertiary mt-0.5">
                    <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-green font-mono">A</kbd> approve &middot; <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-red font-mono">R</kbd> reject &middot; <kbd className="px-1 py-0.5 bg-elevated rounded font-mono">&darr;&uarr;</kbd> nav
                  </p>
                )}
              </div>

              {/* Bulk selection bar — only when pending + has unreviewed items */}
              {isPending && unreviewedCount > 0 && (
                <div className="px-3 py-1.5 border-b border-surface-border shrink-0 flex items-center gap-1.5 bg-elevated/30">
                  <input
                    type="checkbox"
                    checked={bulkSelectedCount === unreviewedCount && unreviewedCount > 0}
                    ref={(el) => { if (el) el.indeterminate = bulkSelectedCount > 0 && bulkSelectedCount < unreviewedCount; }}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-phosphor-teal cursor-pointer"
                  />
                  <span className="text-xxs font-mono text-text-tertiary flex-1">{unreviewedCount} remaining</span>
                  {bulkSelectedCount > 0 && (
                    <>
                      <button onClick={handleBulkApprove}
                        className="px-2 py-0.5 text-xxs font-mono font-bold bg-phosphor-green/15 text-phosphor-green rounded hover:bg-phosphor-green/25 transition-colors">
                        Approve ({bulkSelectedCount})
                      </button>
                      <button onClick={handleBulkReject}
                        className="px-2 py-0.5 text-xxs font-mono font-bold bg-phosphor-red/15 text-phosphor-red rounded hover:bg-phosphor-red/25 transition-colors">
                        Reject ({bulkSelectedCount})
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Scrollable object list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {allObjects.map(obj => {
                  const isActive = obj.key === activeObjectKey;
                  const decision = objectDecisions[obj.key];
                  const hasDecision = decision != null;
                  const appeal = appealDecisions?.[obj.key];
                  const isAppealed = appeal?.status === 'appealed';
                  const isAppealResolved = appeal?.status === 're_approved' || appeal?.status === 're_rejected';
                  const isAppealingThis = appealingKey === obj.key;
                  const alreadyAppealed = !!appeal;
                  const isUnreviewed = !hasDecision;

                  return (
                    <div key={obj.key}>
                      <div
                        onClick={() => handleSelectObject(obj.key)}
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
                        {/* Checkbox (only when pending + unreviewed) */}
                        {isPending && isUnreviewed && (
                          <input
                            type="checkbox"
                            checked={effectiveBulkSelected.has(obj.key)}
                            onChange={() => toggleBulkSelect(obj.key)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 shrink-0 accent-phosphor-teal cursor-pointer"
                          />
                        )}

                        {/* Label color dot */}
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          (obj.label === 1 || obj.label === true) ? "bg-phosphor-red" : "bg-phosphor-green"
                        )} />

                        {/* Object info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-text-tertiary/60 font-mono">
                              {obj.frameSide} F{obj.frameIndex}
                            </span>
                            {isAppealed && (
                              <span className="text-xxs font-mono text-yellow-400 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Appealed
                              </span>
                            )}
                            {isAppealResolved && (
                              <span className={cn(
                                "text-xxs font-mono",
                                appeal.status === 're_approved' ? "text-phosphor-green" : "text-phosphor-red"
                              )}>
                                {appeal.status === 're_approved' ? 'Re-approved' : 'Re-rejected'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Approve/Reject buttons (pending) or status badge + appeal (reviewed) */}
                        {isPending ? (
                          <div className="flex items-center rounded overflow-hidden border border-surface-border shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleObjectDecision(obj.key, 'approved'); }}
                              className={cn("px-1.5 py-0.5 transition-all",
                                decision === 'approved' ? "bg-phosphor-green/20 text-phosphor-green" : "text-text-tertiary hover:text-phosphor-green hover:bg-phosphor-green/5"
                              )} title="Approve (A)">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-4 bg-surface-border" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleObjectDecision(obj.key, 'rejected'); }}
                              className={cn("px-1.5 py-0.5 transition-all",
                                decision === 'rejected' ? "bg-phosphor-red/20 text-phosphor-red" : "text-text-tertiary hover:text-phosphor-red hover:bg-phosphor-red/5"
                              )} title="Reject (R)">
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
                            {canAppeal && hasDecision && !alreadyAppealed && (
                              <button onClick={(e) => { e.stopPropagation(); setAppealingKey(obj.key); setAppealReason(''); }}
                                className="px-1.5 py-0.5 text-xxs font-mono text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                                title="Appeal this decision">
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
                            onChange={(e) => setAppealReason(e.target.value)}
                            placeholder="Explain why this decision should be re-reviewed..."
                            rows={2}
                            className="w-full px-2 py-1.5 bg-elevated border border-surface-border rounded text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setAppealingKey(null); setAppealReason(''); }}
                              className="px-2 py-1 text-xxs text-text-tertiary hover:text-text-primary transition-colors">
                              Cancel
                            </button>
                            <button onClick={handleAppealSubmit}
                              disabled={!appealReason.trim() || appealProcessing}
                              className="px-2 py-1 text-xxs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
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

              {/* Operator reason + notes (pinned) */}
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

              {/* History timeline (collapsible) */}
              {historyEntries.length > 0 && (
                <div className="border-t border-surface-border shrink-0">
                  <button onClick={() => setHistoryCollapsed(prev => !prev)}
                    className="w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-elevated/50 transition-colors">
                    <Clock className="w-3 h-3 text-text-tertiary" />
                    <span className="text-xxs font-mono text-text-tertiary uppercase flex-1 text-left">History</span>
                    <ChevronDown className={cn("w-3 h-3 text-text-tertiary transition-transform", historyCollapsed ? "-rotate-90" : "rotate-0")} />
                  </button>
                  {!historyCollapsed && (
                    <div className="px-3 pb-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {historyEntries.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                            entry.type === 'created' ? "bg-phosphor-cyan"
                              : entry.type === 'reviewed' ? "bg-phosphor-teal"
                              : entry.type === 'appealed' ? "bg-yellow-400"
                              : entry.type === 'appeal_approved' ? "bg-phosphor-green"
                              : "bg-phosphor-red"
                          )} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xxs font-mono text-text-secondary font-medium">{entry.who}</span>
                              <span className="text-xxs text-text-tertiary">{formatTime(entry.when)}</span>
                            </div>
                            <p className="text-xxs text-text-tertiary truncate" title={entry.text}>{entry.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit / status area (pinned at bottom) */}
              {isPending ? (
                <div className="px-3 py-2 border-t border-surface-border shrink-0 space-y-2">
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder={t('manager.addNotes')}
                    rows={2}
                    disabled={isProcessing}
                    className="w-full px-2 py-1.5 bg-elevated border border-surface-border rounded text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-teal resize-none disabled:opacity-50"
                  />
                  {allReviewed ? (
                    <button onClick={() => setShowSummary(true)}
                      className="w-full h-8 bg-phosphor-teal text-void font-display font-bold text-xs rounded hover:bg-phosphor-teal-bright transition-all flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Review Summary &amp; Submit
                    </button>
                  ) : (
                    <div className="text-center">
                      <span className="text-xxs text-text-tertiary font-mono">
                        Review all objects to submit ({reviewedCount}/{totalObjects})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2 border-t border-surface-border shrink-0">
                  {override.reviewNotes || override.review_notes ? (
                    <div className="mb-2">
                      <span className="text-xxs text-text-tertiary font-mono uppercase">Reviewer Notes</span>
                      <p className="text-xs text-text-primary">{override.reviewNotes || override.review_notes}</p>
                    </div>
                  ) : null}
                  <button onClick={handleClose}
                    className="w-full h-8 bg-elevated border border-surface-border text-text-primary font-display font-bold text-xs rounded hover:border-phosphor-teal/50 transition-colors">
                    Close
                  </button>
                </div>
              )}
            </div>
          </>

        ) : (
          /* ============ Legacy Single-Image View ============ */
          <>
            {/* Left — Image */}
            <div className="flex-1 relative min-w-0 min-h-0 flex items-center justify-center bg-void">
              {getLegacyImageUrl() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getLegacyImageUrl()}
                  alt="False call image"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-text-tertiary">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">{t('manager.noImageAvailable')}</p>
                </div>
              )}
            </div>

            {/* Right — Info + Actions */}
            <div className="w-80 flex flex-col shrink-0 bg-terminal border-l border-surface-border overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div>
                  <span className="text-xs text-text-tertiary font-mono uppercase">AI Flagged</span>
                  <p className="text-sm text-phosphor-red font-medium">{override.defectType || override.defect_type || 'Unknown'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-text-tertiary font-mono uppercase">{t('hmi.reason')}</span>
                    <p className="text-sm text-text-primary">{override.reason || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-text-tertiary font-mono uppercase">{t('manager.operatorNotes')}</span>
                    <p className="text-sm text-text-primary">{override.operatorNotes || override.operator_notes || '-'}</p>
                  </div>
                </div>

                {isAlreadyReviewed ? (
                  <div>
                    <span className="text-xs text-text-tertiary font-mono uppercase">{t('manager.reviewerNotes')}</span>
                    <p className="text-sm text-text-primary">{override.reviewNotes || override.review_notes || '-'}</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs text-text-tertiary font-mono uppercase">{t('manager.reviewerNotesOptional')}</span>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder={t('manager.addNotes')}
                      rows={2}
                      disabled={isProcessing}
                      className="w-full mt-1 px-3 py-2 bg-elevated border border-surface-border rounded text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-teal resize-none disabled:opacity-50"
                    />
                  </div>
                )}

                {/* History timeline */}
                {historyEntries.length > 0 && (
                  <div className="border-t border-surface-border pt-3">
                    <button onClick={() => setHistoryCollapsed(prev => !prev)}
                      className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3 h-3 text-text-tertiary" />
                      <span className="text-xxs font-mono text-text-tertiary uppercase">History</span>
                      <ChevronDown className={cn("w-3 h-3 text-text-tertiary transition-transform", historyCollapsed ? "-rotate-90" : "rotate-0")} />
                    </button>
                    {!historyCollapsed && (
                      <div className="space-y-1.5">
                        {historyEntries.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                              entry.type === 'created' ? "bg-phosphor-cyan"
                                : entry.type === 'reviewed' ? "bg-phosphor-teal"
                                : entry.type === 'appealed' ? "bg-yellow-400"
                                : entry.type === 'appeal_approved' ? "bg-phosphor-green"
                                : "bg-phosphor-red"
                            )} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xxs font-mono text-text-secondary font-medium">{entry.who}</span>
                                <span className="text-xxs text-text-tertiary">{formatTime(entry.when)}</span>
                              </div>
                              <p className="text-xxs text-text-tertiary truncate" title={entry.text}>{entry.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {isAlreadyReviewed ? (
                <div className="px-4 py-3 border-t border-surface-border shrink-0">
                  <button onClick={handleClose}
                    className="w-full h-9 bg-elevated border border-surface-border text-text-primary font-display font-bold text-sm rounded-lg hover:border-phosphor-teal/50 transition-colors">
                    {t('buttons.close')}
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-surface-border shrink-0 flex gap-2">
                  <button onClick={handleReject} disabled={isProcessing}
                    className="flex-1 h-9 border border-phosphor-red text-phosphor-red rounded-lg font-medium text-sm hover:bg-phosphor-red/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-phosphor-red/30 border-t-phosphor-red rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                    {t('manager.reject')}
                  </button>
                  <button onClick={handleApprove} disabled={isProcessing}
                    className="flex-1 h-9 bg-phosphor-green text-void rounded-lg font-display font-bold text-sm hover:bg-phosphor-green-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                    {isProcessing ? <><div className="w-3.5 h-3.5 border-2 border-void/30 border-t-void rounded-full animate-spin" />{t('manager.processing')}</> : <><CheckCircle className="w-4 h-4" />{t('manager.approve')}</>}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Sub-components
// ====================================================================

/** Summary View — shows review decisions grouped by SN */
function SummaryView({ objectsBySn, snList, objectDecisions, onClickObject, t }) {
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

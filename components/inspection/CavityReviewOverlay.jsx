'use client'

/**
 * CavityReviewOverlay V3
 * Full-screen overlay for reviewing NG objects one by one.
 *
 * Flow:
 * 1. Collect all NG frames from TOP + BOTTOM sides
 * 2. Flatten all detected objects across NG frames
 * 3. Show PCB image with bbox overlays via ImageViewer
 * 4. Right panel lists all objects — click to zoom to that object
 * 5. For each object: GOOD (false call, needs reason) or NG (confirm)
 * 6. After all objects reviewed, derive frame decisions:
 *    - Frame has ANY REAL_NG object → frame = REAL_NG
 *    - All objects false call → frame = first reason
 * 7. Keyboard shortcuts: G = GOOD, N = NG, Arrow Up/Down = navigate objects
 * 8. Auto-NG countdown resets per object
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { findNextUnreviewedFrame, computePcbCounts } from '@/lib/utils/inspectionReview'
import { classifySerialNumber, isRealPcb, SN_TYPE } from '@/lib/utils/serialNumber'
import { X, CheckCircle2, AlertCircle, Timer, Hash, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import ImageViewer from '@/components/common/ImageViewer'
import { getModelImage } from '@/lib/utils/modelImages'

const AUTO_NG_DELAY_MS = 10000 // 10 seconds per object

// Generate deterministic color from serial number (same as SidePanel)
function snToColor(sn) {
  let hash = 2166136261
  for (let i = 0; i < sn.length; i++) {
    hash ^= sn.charCodeAt(i)
    hash = (hash * 16777619) | 0
  }
  const hue = ((hash >>> 0) * 137.508) % 360
  return `hsl(${hue}, 75%, 55%)`
}

/**
 * Build a unique key for an object within a frame.
 * Format: "TOP-0-OBJ-2"
 */
function objKey(side, frameIndex, objectIndex) {
  return `${side}-${frameIndex}-OBJ-${objectIndex}`
}

/**
 * Derive per-frame decisions from per-object decisions.
 * A frame is REAL_NG if ANY object in it is REAL_NG.
 * Otherwise uses the first false call reason.
 */
function deriveFrameDecisions(allObjects, objectDecisions) {
  const frameMap = {} // "TOP-0" → { hasRealNG, firstReason }
  allObjects.forEach(obj => {
    const frameKey = `${obj.frameSide}-${obj.frameIndex}`
    if (!frameMap[frameKey]) frameMap[frameKey] = { hasRealNG: false, firstReason: null }
    const decision = objectDecisions[obj.key]
    if (decision === 'REAL_NG') {
      frameMap[frameKey].hasRealNG = true
    } else if (decision && !frameMap[frameKey].firstReason) {
      frameMap[frameKey].firstReason = decision
    }
  })
  const result = {}
  for (const [key, { hasRealNG, firstReason }] of Object.entries(frameMap)) {
    result[key] = hasRealNG ? 'REAL_NG' : (firstReason || 'REAL_NG')
  }
  return result
}

export function CavityReviewOverlay({
  inspection,
  modelName: modelNameProp,
  queuePosition,
  queueTotal,
  autoNgEnabled,
  onConfirmNG,
  onConfirmGood,
  onClose,
  falseCallReasons = [],
  initialFrameIndex = 0,
  initialDecisions = {},
  onDecisionChange,
  cavityCount = 0,
  topFrameCount = 0,
  bottomFrameCount = 0,
}) {
  const { t } = useI18n()

  // Collect all NG frames
  const ngFrames = useMemo(() => {
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    const hasSerialData = [...topFrames, ...bottomFrames].some(f => f.serial_number != null)
    const frames = []
    topFrames.forEach((f, idx) => {
      if (f.label == true && (!hasSerialData || isRealPcb(f.serial_number)))
        frames.push({ ...f, side: 'TOP', frameIndex: idx })
    })
    bottomFrames.forEach((f, idx) => {
      if (f.label == true && (!hasSerialData || isRealPcb(f.serial_number)))
        frames.push({ ...f, side: 'BOTTOM', frameIndex: idx })
    })
    return frames
  }, [inspection])

  // Flatten all objects across all NG frames
  const allObjects = useMemo(() => {
    const result = []
    ngFrames.forEach(frame => {
      (frame.objects || []).forEach((obj, objIdx) => {
        result.push({
          ...obj,
          frameSide: frame.side,
          frameIndex: frame.frameIndex,
          objectIndex: objIdx,
          serialNumber: frame.serial_number,
          imageUrl: frame.image_raw_url || frame.image_url,
          key: objKey(frame.side, frame.frameIndex, objIdx),
        })
      })
    })
    return result
  }, [ngFrames])

  const totalObjects = allObjects.length
  // Fall back to per-frame review if no objects detected (legacy data)
  const hasObjects = totalObjects > 0
  // Only NG objects (label=1/true) need operator review, GOOD objects (label=0/false) are auto-OK
  const ngOnlyObjects = useMemo(() => allObjects.filter(o => o.label === 1 || o.label === true), [allObjects])
  const ngOnlyCount = ngOnlyObjects.length

  // Per-object review state — start with no object selected (full PCB view)
  const [activeObjectIdx, setActiveObjectIdx] = useState(null)
  // Active frame index for multi-frame navigation (thumbnail strip)
  const [activeFrameIdx, setActiveFrameIdx] = useState(0)
  const [objectDecisions, setObjectDecisions] = useState({})
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')

  // Legacy per-frame state (when no objects)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [frameDecisions, setFrameDecisions] = useState(initialDecisions)

  // Auto-NG countdown
  const [countdown, setCountdown] = useState(AUTO_NG_DELAY_MS / 1000)
  const countdownRef = useRef(null)
  const handleObjectNGRef = useRef(null)

  const activeObject = activeObjectIdx != null ? (allObjects[activeObjectIdx] || null) : null
  const currentFrame = hasObjects
    ? (activeObject
        ? ngFrames.find(f => f.side === activeObject.frameSide && f.frameIndex === activeObject.frameIndex)
        : ngFrames[activeFrameIdx] || ngFrames[0])  // Show selected frame when no object selected
    : ngFrames[reviewIndex]

  // Objects in the current frame for ImageViewer bbox overlay
  const currentFrameObjects = useMemo(() => {
    if (!currentFrame) return []
    return (currentFrame.objects || []).map((obj, idx) => ({
      name: obj.name,
      box: obj.box,
      score: obj.score,
      label: obj.label,
      _key: objKey(currentFrame.side, currentFrame.frameIndex, idx),
    }))
  }, [currentFrame])

  // Active object index within its frame (for ImageViewer highlight)
  // Returns -1 when no object selected → ImageViewer shows full PCB without zoom
  const activeObjectFrameIdx = useMemo(() => {
    if (activeObjectIdx == null || !activeObject || !currentFrame) return -1
    return activeObject.objectIndex
  }, [activeObjectIdx, activeObject, currentFrame])

  // Reset when inspection changes
  useEffect(() => {
    setActiveObjectIdx(null)
    setActiveFrameIdx(0)
    setObjectDecisions({})
    setFrameDecisions(initialDecisions)
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
    setReviewIndex(initialFrameIndex)
  }, [inspection]) // eslint-disable-line react-hooks/exhaustive-deps

  // Complete review — derive frame decisions from object decisions, then call parent
  const completeReview = useCallback((allObjDecisions) => {
    const derivedFrameDecisions = deriveFrameDecisions(allObjects, allObjDecisions)
    const hasRealNG = Object.values(derivedFrameDecisions).some(d => d === 'REAL_NG')

    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    const frameLayout = {
      cavityCount,
      topFrameCount: topFrameCount || topFrames.length,
      bottomFrameCount: bottomFrameCount || bottomFrames.length,
    }
    const pcbCounts = computePcbCounts(ngFrames, derivedFrameDecisions, frameLayout)

    if (hasRealNG) {
      const hasFalseCall = Object.values(derivedFrameDecisions).some(d => d && d !== 'REAL_NG')
      const firstReason = Object.values(derivedFrameDecisions).find(d => d && d !== 'REAL_NG') || ''
      onConfirmNG?.({
        reason: hasFalseCall ? firstReason : null,
        decisions: derivedFrameDecisions,
        pcbCounts,
      })
    } else {
      const firstReason = Object.values(allObjDecisions).find(d => d !== 'REAL_NG') || ''
      onConfirmGood?.(firstReason, derivedFrameDecisions, pcbCounts)
    }
  }, [onConfirmNG, onConfirmGood, allObjects, ngFrames, inspection, cavityCount, topFrameCount, bottomFrameCount])

  // Legacy complete (no objects)
  const completeLegacyReview = useCallback((allDecisions) => {
    const hasRealNG = Object.values(allDecisions).some(d => d === 'REAL_NG')
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    const frameLayout = {
      cavityCount,
      topFrameCount: topFrameCount || topFrames.length,
      bottomFrameCount: bottomFrameCount || bottomFrames.length,
    }
    const pcbCounts = computePcbCounts(ngFrames, allDecisions, frameLayout)
    if (hasRealNG) {
      const hasFalseCall = Object.values(allDecisions).some(d => d && d !== 'REAL_NG')
      const firstReason = Object.values(allDecisions).find(d => d && d !== 'REAL_NG') || ''
      onConfirmNG?.({ reason: hasFalseCall ? firstReason : null, decisions: hasFalseCall ? allDecisions : null, pcbCounts })
    } else {
      const firstReason = Object.values(allDecisions).find(d => d !== 'REAL_NG') || ''
      onConfirmGood?.(firstReason, allDecisions, pcbCounts)
    }
  }, [onConfirmNG, onConfirmGood, ngFrames, inspection, cavityCount, topFrameCount, bottomFrameCount])

  // Auto-complete when all reviewed
  const completeReviewRef = useRef(null)
  completeReviewRef.current = hasObjects ? completeReview : completeLegacyReview

  useEffect(() => {
    if (hasObjects) {
      // Only NG objects need review — count decisions for NG-labeled objects only
      const ngReviewedCount = ngOnlyObjects.filter(o => objectDecisions[o.key] != null).length
      if (ngReviewedCount > 0 && ngReviewedCount === ngOnlyCount) {
        const timer = setTimeout(() => completeReviewRef.current?.(objectDecisions), 800)
        return () => clearTimeout(timer)
      }
    } else {
      const reviewedCount = Object.keys(frameDecisions).length
      if (reviewedCount > 0 && reviewedCount === ngFrames.length) {
        const timer = setTimeout(() => completeReviewRef.current?.(frameDecisions), 800)
        return () => clearTimeout(timer)
      }
    }
  }, [hasObjects, objectDecisions, frameDecisions, totalObjects, ngFrames.length])

  // Find next unreviewed NG object (skip GOOD objects)
  const advanceToNextObject = useCallback((allObjDecisions, fromIdx) => {
    for (let i = fromIdx; i < allObjects.length; i++) {
      const isNG = allObjects[i].label === 1 || allObjects[i].label === true
      if (isNG && !allObjDecisions[allObjects[i].key]) {
        setActiveObjectIdx(i)
        return
      }
    }
    // Wrap around
    for (let i = 0; i < fromIdx; i++) {
      const isNG = allObjects[i].label === 1 || allObjects[i].label === true
      if (isNG && !allObjDecisions[allObjects[i].key]) {
        setActiveObjectIdx(i)
        return
      }
    }
    // All NG objects reviewed — useEffect handles completion
  }, [allObjects])

  // Confirm current object as REAL NG
  const handleObjectNG = useCallback(() => {
    if (hasObjects) {
      // If no object selected yet, select first object instead of confirming
      if (activeObjectIdx == null) { setActiveObjectIdx(0); return }
      if (!activeObject) return
      if (countdownRef.current) clearInterval(countdownRef.current)
      const newDecisions = { ...objectDecisions, [activeObject.key]: 'REAL_NG' }
      setObjectDecisions(newDecisions)
      // Also sync to parent via frame key for backward compatibility
      const frameKey = `${activeObject.frameSide}-${activeObject.frameIndex}`
      onDecisionChange?.(frameKey, 'REAL_NG')
      setShowReasonInput(false)
      setSelectedReason('')
      advanceToNextObject(newDecisions, activeObjectIdx + 1)
    } else {
      // Legacy per-frame
      if (!currentFrame) return
      if (countdownRef.current) clearInterval(countdownRef.current)
      const key = `${currentFrame.side}-${currentFrame.frameIndex}`
      const newDecisions = { ...frameDecisions, [key]: 'REAL_NG' }
      setFrameDecisions(newDecisions)
      onDecisionChange?.(key, 'REAL_NG')
      setShowReasonInput(false)
      setSelectedReason('')
      const nextIdx = findNextUnreviewedFrame(ngFrames, newDecisions, reviewIndex + 1)
      if (nextIdx !== -1) setReviewIndex(nextIdx)
    }
  }, [hasObjects, activeObject, activeObjectIdx, objectDecisions, advanceToNextObject, onDecisionChange,
      currentFrame, frameDecisions, reviewIndex, ngFrames])

  useEffect(() => { handleObjectNGRef.current = handleObjectNG }, [handleObjectNG])

  const handleObjectGood = useCallback(() => {
    // If no object selected yet, select first object instead
    if (hasObjects && activeObjectIdx == null) { setActiveObjectIdx(0); return }
    if (countdownRef.current) clearInterval(countdownRef.current)
    setShowReasonInput(true)
  }, [hasObjects, activeObjectIdx])

  const handleSubmitFalseCall = useCallback(() => {
    const effectiveReason = selectedReason === 'other' ? otherText.trim() : selectedReason.trim()
    if (!effectiveReason) return

    if (hasObjects) {
      if (!activeObject) return
      const newDecisions = { ...objectDecisions, [activeObject.key]: effectiveReason }
      setObjectDecisions(newDecisions)
      const frameKey = `${activeObject.frameSide}-${activeObject.frameIndex}`
      onDecisionChange?.(frameKey, effectiveReason)
      setShowReasonInput(false)
      setSelectedReason('')
      setOtherText('')
      advanceToNextObject(newDecisions, activeObjectIdx + 1)
    } else {
      if (!currentFrame) return
      const key = `${currentFrame.side}-${currentFrame.frameIndex}`
      const newDecisions = { ...frameDecisions, [key]: effectiveReason }
      setFrameDecisions(newDecisions)
      onDecisionChange?.(key, effectiveReason)
      setShowReasonInput(false)
      setSelectedReason('')
      setOtherText('')
      const nextIdx = findNextUnreviewedFrame(ngFrames, newDecisions, reviewIndex + 1)
      if (nextIdx !== -1) setReviewIndex(nextIdx)
    }
  }, [hasObjects, activeObject, objectDecisions, activeObjectIdx, advanceToNextObject, onDecisionChange,
      selectedReason, otherText, currentFrame, frameDecisions, reviewIndex, ngFrames])

  const handleCancelReason = useCallback(() => {
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
  }, [])

  // Inline NG from sidebar button (directly marks object as REAL_NG)
  const handleInlineNG = useCallback((idx) => {
    const obj = allObjects[idx]
    if (!obj || objectDecisions[obj.key] != null) return
    if (countdownRef.current) clearInterval(countdownRef.current)
    const newDecisions = { ...objectDecisions, [obj.key]: 'REAL_NG' }
    setObjectDecisions(newDecisions)
    const frameKey = `${obj.frameSide}-${obj.frameIndex}`
    onDecisionChange?.(frameKey, 'REAL_NG')
    setShowReasonInput(false)
    advanceToNextObject(newDecisions, idx + 1)
  }, [allObjects, objectDecisions, advanceToNextObject, onDecisionChange])

  // Inline GOOD from sidebar button (opens reason input for that object)
  const handleInlineGood = useCallback((idx) => {
    const obj = allObjects[idx]
    if (!obj || objectDecisions[obj.key] != null) return
    if (countdownRef.current) clearInterval(countdownRef.current)
    setActiveObjectIdx(idx)
    setShowReasonInput(true)
  }, [allObjects, objectDecisions])

  // Auto-NG countdown
  useEffect(() => {
    const isCurrentReviewed = hasObjects
      ? (activeObject && objectDecisions[activeObject.key] != null)
      : (currentFrame && frameDecisions[`${currentFrame.side}-${currentFrame.frameIndex}`] != null)

    if (!autoNgEnabled || showReasonInput || isCurrentReviewed || (!activeObject && hasObjects) || (!currentFrame && !hasObjects)) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }

    setCountdown(AUTO_NG_DELAY_MS / 1000)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          handleObjectNGRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [autoNgEnabled, showReasonInput, hasObjects, activeObjectIdx, reviewIndex, activeObject, currentFrame, objectDecisions, frameDecisions])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (showReasonInput) return

      const isReviewed = hasObjects
        ? (activeObject && objectDecisions[activeObject.key] != null)
        : (currentFrame && frameDecisions[`${currentFrame.side}-${currentFrame.frameIndex}`] != null)
      if (isReviewed) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleObjectNGRef.current?.()
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        handleObjectGood()
      } else if (hasObjects && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
        e.preventDefault()
        setActiveObjectIdx(prev => prev == null ? 0 : Math.min(allObjects.length - 1, prev + 1))
      } else if (hasObjects && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        setActiveObjectIdx(prev => prev == null ? 0 : Math.max(0, prev - 1))
      } else if (!hasObjects && e.key === 'ArrowRight') {
        e.preventDefault()
        setReviewIndex(prev => Math.min(ngFrames.length - 1, prev + 1))
      } else if (!hasObjects && e.key === 'ArrowLeft') {
        e.preventDefault()
        setReviewIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showReasonInput, hasObjects, activeObject, objectDecisions, currentFrame, frameDecisions, handleObjectGood, onClose, allObjects.length, ngFrames.length])

  if (!inspection || (!currentFrame && !hasObjects)) return null

  // Only count NG-labeled objects for review progress (GOOD objects are auto-OK)
  const reviewedCount = hasObjects
    ? ngOnlyObjects.filter(o => objectDecisions[o.key] != null).length
    : Object.keys(frameDecisions).length
  const totalReviewable = hasObjects ? ngOnlyCount : ngFrames.length
  const currentDecisionKey = hasObjects
    ? activeObject?.key
    : (currentFrame ? `${currentFrame.side}-${currentFrame.frameIndex}` : null)
  const currentDecision = hasObjects ? objectDecisions[currentDecisionKey] : frameDecisions[currentDecisionKey]
  const isCurrentReviewed = currentDecision != null

  return (
    <div className="fixed inset-0 z-[100] bg-void flex flex-col animate-fade-in">

      {/* ============ Header ============ */}
      <div className="h-12 px-6 flex items-center justify-between bg-terminal border-b border-surface-border shrink-0">
        <div className="flex items-center gap-4">
          {queueTotal > 1 && (
            <span className="font-display font-bold text-phosphor-teal text-lg">
              PCB {queuePosition}/{queueTotal}
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-phosphor-red/20 text-phosphor-red font-mono text-sm font-bold">
            {t('cavityReview.aiNG')}
          </span>
          {hasObjects ? (
            <span className="px-2 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal font-mono text-sm font-bold">
              {totalObjects} object{totalObjects !== 1 ? 's' : ''} &middot; {ngFrames.length} frame{ngFrames.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal font-mono text-sm font-bold">
              {t('cavityReview.ngFrame')} {reviewIndex + 1}/{ngFrames.length}
            </span>
          )}
          {reviewedCount > 0 && (
            <span className="font-mono text-xs text-text-tertiary">
              ({reviewedCount}/{totalReviewable} {t('cavityReview.reviewed')})
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {autoNgEnabled && !showReasonInput && !isCurrentReviewed && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded font-mono text-sm",
              countdown <= 5 ? "bg-phosphor-red/20 text-phosphor-red" : "bg-phosphor-teal/20 text-phosphor-teal"
            )}>
              <Timer className="w-4 h-4" />
              {t('cavityReview.autoNG')}: {countdown}s
            </div>
          )}
          {onClose && (
            <button onClick={onClose}
              className="p-2 rounded bg-elevated border border-surface-border hover:border-phosphor-teal/50 transition-colors">
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          )}
        </div>
      </div>

      {/* ============ Main content ============ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left — Image Viewer */}
        <div className="flex-1 relative min-w-0">
          {/* SN badge */}
          {(() => {
            const sn = currentFrame?.serial_number
            if (sn == null) return null
            const snType = classifySerialNumber(sn)
            if (snType === SN_TYPE.EMPTY) return null
            const isTimestamp = snType === SN_TYPE.TIMESTAMP
            return (
              <div className={cn(
                "absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-void/85 backdrop-blur-sm",
                isTimestamp ? "border border-yellow-500/60" : "border border-phosphor-teal/50"
              )}>
                <span className={cn(
                  "font-mono text-sm font-bold",
                  isTimestamp ? "text-yellow-400" : "text-phosphor-teal"
                )}>
                  SN: {String(sn)}
                </span>
              </div>
            )
          })()}

          {currentFrame && (currentFrame.image_raw_url || currentFrame.image_url) ? (
            <ImageViewer
              src={getModelImage(modelNameProp || inspection?.modelName || inspection?.modelId, currentFrame.side) || currentFrame.image_raw_url || currentFrame.image_url}
              alt={`${currentFrame.side} frame ${currentFrame.frameIndex + 1}`}
              objects={currentFrameObjects}
              activeObjectIndex={hasObjects ? activeObjectFrameIdx : -1}
              onObjectClick={hasObjects ? (idx) => {
                // Find the global index for this frame object
                const clickedKey = currentFrameObjects[idx]?._key
                if (clickedKey) {
                  const globalIdx = allObjects.findIndex(o => o.key === clickedKey)
                  if (globalIdx !== -1) setActiveObjectIdx(globalIdx)
                }
              } : undefined}
              className="w-full h-full"
              showControls={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-tertiary bg-void">
              <p className="font-mono text-sm">{t('inspection.noImageAvailable')}</p>
            </div>
          )}
        </div>

        {/* Right — Object list panel + frame thumbnails (only when objects exist) */}
        {hasObjects && (
          <div className="w-80 flex flex-col shrink-0 bg-terminal border-l border-surface-border overflow-hidden">
            {/* Frame Thumbnail Strip — click to switch between NG frames */}
            {ngFrames.length > 1 && (
              <div className="px-2 py-2 border-b border-surface-border shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {ngFrames.map((frame, fIdx) => {
                    const isActiveFrame = currentFrame === frame
                    const sn = frame.serial_number
                    const snType = classifySerialNumber(sn)
                    const frameImgUrl = frame.image_url || frame.image_raw_url
                    return (
                      <button
                        key={`${frame.side}-${frame.frameIndex}`}
                        onClick={() => { setActiveFrameIdx(fIdx); setActiveObjectIdx(null) }}
                        className={cn(
                          "relative flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all",
                          isActiveFrame
                            ? "border-phosphor-teal ring-1 ring-phosphor-teal/40"
                            : "border-surface-border hover:border-phosphor-teal/50"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={frameImgUrl}
                          alt={`${frame.side} F${frame.frameIndex}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Side label */}
                        <span className="absolute top-0 left-0 px-0.5 text-[7px] font-mono font-bold bg-void/70 text-text-primary rounded-br">
                          {frame.side[0]}
                        </span>
                        {/* NG badge */}
                        <div className="absolute top-0 right-0 w-3 h-3 rounded-bl bg-phosphor-red flex items-center justify-center">
                          <AlertCircle className="w-2 h-2 text-white" />
                        </div>
                        {/* SN color bar */}
                        {snType === SN_TYPE.TIMESTAMP ? (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500/60"
                            style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)' }}
                          />
                        ) : snType === SN_TYPE.REAL && sn ? (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-1"
                            style={{ backgroundColor: snToColor(sn) }}
                          />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Panel header */}
            <div className="px-3 py-2 border-b border-surface-border shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-wide">
                  Objects ({totalObjects})
                </h3>
                <div className="flex items-center gap-2">
                  {ngOnlyCount > 0 && (
                    <span className="text-xxs font-mono text-phosphor-red">{ngOnlyCount} NG</span>
                  )}
                  {reviewedCount > 0 && (
                    <span className="text-xxs font-mono text-phosphor-teal">
                      {reviewedCount}/{ngOnlyCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xxs text-text-tertiary mt-0.5">
                <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-green font-mono">G</kbd> good &middot; <kbd className="px-1 py-0.5 bg-elevated rounded text-phosphor-red font-mono">N</kbd> NG &middot; <kbd className="px-1 py-0.5 bg-elevated rounded font-mono">&darr;&uarr;</kbd> nav
              </p>
            </div>

            {/* Scrollable object list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {allObjects.map((obj, idx) => {
                const isActive = idx === activeObjectIdx
                const isObjNG = obj.label === 1 || obj.label === true
                const decision = objectDecisions[obj.key]
                const decisionIsNG = decision === 'REAL_NG'
                const isFalseCall = decision && decision !== 'REAL_NG'
                const isReviewed = decision != null

                return (
                  <div
                    key={obj.key}
                    onClick={() => setActiveObjectIdx(idx)}
                    className={cn(
                      "px-3 py-1.5 cursor-pointer transition-all border-l-2",
                      isActive
                        ? "bg-phosphor-teal/10 border-l-phosphor-teal"
                        : isReviewed
                          ? decisionIsNG
                            ? "bg-phosphor-red/5 border-l-phosphor-red/50"
                            : "bg-phosphor-green/5 border-l-phosphor-green/50"
                          : isObjNG
                            ? "border-l-phosphor-red/30 hover:bg-elevated/50"
                            : "bg-phosphor-green/5 border-l-phosphor-green/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {/* Color indicator dot */}
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            isObjNG ? "bg-phosphor-red" : "bg-phosphor-green"
                          )} />
                          <span className={cn(
                            "text-xs font-medium truncate",
                            isActive ? "text-phosphor-teal"
                              : isObjNG ? "text-text-primary" : "text-phosphor-green/80"
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
                      </div>

                      {/* Right side: GOOD objects show green badge, NG objects show buttons or decision badge */}
                      {!isObjNG ? (
                        /* AI says GOOD — auto-OK, no buttons needed */
                        <span className="text-xxs font-mono font-medium px-1.5 py-0.5 rounded shrink-0 bg-phosphor-green/15 text-phosphor-green">
                          GOOD
                        </span>
                      ) : isReviewed ? (
                        /* NG object already reviewed */
                        <span className={cn(
                          "text-xxs font-mono font-medium px-1.5 py-0.5 rounded shrink-0",
                          decisionIsNG ? "bg-phosphor-red/15 text-phosphor-red" : "bg-phosphor-green/15 text-phosphor-green"
                        )}>
                          {decisionIsNG ? 'NG' : 'OK'}
                        </span>
                      ) : (
                        /* NG object needs review — show inline buttons */
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveObjectIdx(idx); handleInlineGood(idx) }}
                            className="px-2 py-1 text-xxs font-mono font-bold rounded bg-phosphor-green/10 border border-phosphor-green/40 text-phosphor-green hover:bg-phosphor-green/25 transition-colors"
                            title="GOOD (G)"
                          >
                            OK
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveObjectIdx(idx); handleInlineNG(idx) }}
                            className="px-2 py-1 text-xxs font-mono font-bold rounded bg-phosphor-red/10 border border-phosphor-red/40 text-phosphor-red hover:bg-phosphor-red/25 transition-colors"
                            title="NG (N)"
                          >
                            NG
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============ Footer: Reason input / Status ============ */}
      <div className="h-16 px-6 flex items-center justify-center gap-8 bg-terminal border-t border-surface-border shrink-0">
        {showReasonInput ? (
          <div className="flex items-center gap-4 w-full max-w-2xl">
            {selectedReason === 'other' ? (
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => { setSelectedReason(''); setOtherText('') }}
                  className="h-10 px-3 bg-elevated border border-surface-border rounded-lg text-text-secondary font-mono hover:border-phosphor-teal/50 transition-colors flex-shrink-0"
                >
                  &larr;
                </button>
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitFalseCall() }}
                  placeholder={t('cavityReview.typeOtherReason')}
                  autoFocus
                  className="flex-1 h-10 px-4 bg-elevated border border-surface-border rounded-lg text-text-primary font-mono placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-phosphor-green"
                />
              </div>
            ) : (
              <select
                value={selectedReason}
                onChange={(e) => { setSelectedReason(e.target.value); setOtherText('') }}
                autoFocus
                className="flex-1 h-10 px-4 bg-elevated border border-surface-border rounded-lg text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-phosphor-green"
              >
                <option value="">{t('cavityReview.selectReason')}</option>
                {falseCallReasons
                  .filter(r => !(r.name || r).toLowerCase().includes('other'))
                  .map(r => (
                    <option key={r.id || r} value={r.name || r}>{r.name || r}</option>
                  ))}
                <option value="other">{t('cavityReview.other')}</option>
              </select>
            )}
            <button onClick={handleSubmitFalseCall}
              disabled={selectedReason === 'other' ? !otherText.trim() : !selectedReason.trim()}
              className="h-10 px-6 bg-phosphor-green text-void font-display font-bold rounded-lg hover:bg-phosphor-green-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {t('falseCall.submit')}
            </button>
            <button onClick={handleCancelReason}
              className="h-10 px-4 bg-elevated border border-surface-border text-text-secondary font-display font-bold rounded-lg hover:border-phosphor-teal/50 transition-colors">
              {t('falseCall.cancel')}
            </button>
          </div>
        ) : reviewedCount === totalReviewable && reviewedCount > 0 ? (
          <span className="font-mono text-sm text-phosphor-cyan animate-pulse">
            {t('cavityReview.allReviewed')}
          </span>
        ) : !hasObjects ? (
          /* Legacy per-frame flow — keep large buttons */
          <>
            <button onClick={handleObjectGood}
              className="h-12 px-10 bg-phosphor-green/10 border-2 border-phosphor-green text-phosphor-green font-display font-bold text-lg rounded-lg hover:bg-phosphor-green/20 shadow-glow-green transition-all active:scale-95 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              {t('cavityReview.good')}
              <span className="text-sm font-mono opacity-60">(G)</span>
            </button>
            <button onClick={() => handleObjectNGRef.current?.()}
              className="h-12 px-10 bg-phosphor-red/10 border-2 border-phosphor-red text-phosphor-red font-display font-bold text-lg rounded-lg hover:bg-phosphor-red/20 shadow-glow-red transition-all active:scale-95 flex items-center gap-3">
              <AlertCircle className="w-6 h-6" />
              {t('cavityReview.ng')}
              <span className="text-sm font-mono opacity-60">(N)</span>
            </button>
          </>
        ) : (
          /* Per-object mode — show status summary, buttons are in sidebar */
          <div className="flex items-center gap-4 font-mono text-sm">
            <span className="text-text-tertiary">
              {activeObject ? (
                <>Reviewing: <span className="text-phosphor-teal font-bold">{activeObject.name}</span></>
              ) : (
                <span className="text-text-tertiary">Click an object to review</span>
              )}
            </span>
            {isCurrentReviewed && activeObject && (
              <span className={cn(
                "px-2 py-0.5 rounded",
                currentDecision === 'REAL_NG' ? "bg-phosphor-red/20 text-phosphor-red" : "bg-phosphor-green/20 text-phosphor-green"
              )}>
                {currentDecision === 'REAL_NG'
                  ? t('cavityReview.confirmedNG')
                  : `${t('cavityReview.falseCallPrefix')}: ${currentDecision}`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CavityReviewOverlay

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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { findNextUnreviewedFrame, computePcbCounts, normalizeBox } from '@/lib/utils/inspectionReview'
import { classifySerialNumber, isRealPcb, SN_TYPE } from '@/lib/utils/serialNumber'
import { X, Timer, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import ImageViewer from '@/components/common/ImageViewer'

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

/** Single object row — extracted for accordion reuse */
function ObjectRow({ obj, idx, isActive, isObjNG, isReviewed, decisionIsNG, onSelect, onGood, onNG, showCheckbox, isChecked, onToggleCheck }) {
  return (
    <div
      onClick={() => onSelect(idx)}
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
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isChecked || false}
            onChange={() => onToggleCheck?.(obj.key)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 shrink-0 accent-phosphor-teal cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
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
          {obj.box && obj.box.length >= 4 && (() => {
            const [nx1, ny1, nx2, ny2] = normalizeBox(obj.box)
            return (
              <span className="text-[9px] text-text-tertiary/60 font-mono block ml-3">
                [{Math.round(nx1)}, {Math.round(ny1)}, {Math.round(nx2)}, {Math.round(ny2)}]
              </span>
            )
          })()}
        </div>
        {!isObjNG ? (
          <span className="text-xxs font-mono font-medium px-1.5 py-0.5 rounded shrink-0 bg-phosphor-green/15 text-phosphor-green">
            GOOD
          </span>
        ) : isReviewed ? (
          <span className={cn(
            "text-xxs font-mono font-medium px-1.5 py-0.5 rounded shrink-0",
            decisionIsNG ? "bg-phosphor-red/15 text-phosphor-red" : "bg-phosphor-green/15 text-phosphor-green"
          )}>
            {decisionIsNG ? 'NG' : 'OK'}
          </span>
        ) : (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(idx); onGood?.(idx) }}
              className="px-2 py-1 text-xxs font-mono font-bold rounded bg-phosphor-green/10 border border-phosphor-green/40 text-phosphor-green hover:bg-phosphor-green/25 transition-colors"
              title="GOOD (G)"
            >
              OK
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(idx); onNG?.(idx) }}
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
}

export function CavityReviewOverlay({
  inspection,
  queuePosition,
  queueTotal,
  autoNgEnabled,
  onConfirmNG,
  onConfirmGood,
  onClose,
  falseCallReasons = [],
  initialFrameIndex = 0,
  initialDecisions = {},
  initialObjectDecisions = {},
  onDecisionChange,
  onObjectDecisionsChange,
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

  // Flatten all objects across all NG frames, sorted: NG first (by Y,X coords), then GOOD
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
          cavityIndex: 0,
        })
      })
    })

    // Assign cavity index from spatial X position within each frame
    if (cavityCount > 1) {
      const frameGroups = new Map()
      result.forEach(obj => {
        const fk = `${obj.frameSide}-${obj.frameIndex}`
        if (!frameGroups.has(fk)) frameGroups.set(fk, [])
        frameGroups.get(fk).push(obj)
      })
      for (const objs of frameGroups.values()) {
        let maxX = 0
        objs.forEach(obj => {
          if (!obj.box || obj.box.length < 4) return
          const [, , x2] = normalizeBox(obj.box)
          maxX = Math.max(maxX, x2)
        })
        if (maxX <= 0) continue
        const cavityW = maxX / cavityCount
        objs.forEach(obj => {
          if (!obj.box || obj.box.length < 4) return
          const [bx1, , bx2] = normalizeBox(obj.box)
          const centerX = (bx1 + bx2) / 2
          obj.cavityIndex = Math.min(Math.floor(centerX / cavityW), cavityCount - 1)
        })
      }
    }

    // Sort: NG first → cavity → Y → X, then GOOD → cavity → Y → X
    const isNG = o => o.label === 1 || o.label === true
    result.sort((a, b) => {
      const aNg = isNG(a) ? 0 : 1
      const bNg = isNG(b) ? 0 : 1
      if (aNg !== bNg) return aNg - bNg
      // Within same group, sort by cavity then Y then X
      if (a.cavityIndex !== b.cavityIndex) return a.cavityIndex - b.cavityIndex
      const [ax1, ay1] = normalizeBox(a.box || [0,0,0,0])
      const [bx1, by1] = normalizeBox(b.box || [0,0,0,0])
      return ay1 - by1 || ax1 - bx1
    })
    return result
  }, [ngFrames, cavityCount])

  const totalObjects = allObjects.length
  // Fall back to per-frame review if no objects detected (legacy data)
  const hasObjects = totalObjects > 0
  // Only NG objects (label=1/true) need operator review, GOOD objects (label=0/false) are auto-OK
  const ngOnlyObjects = useMemo(() => allObjects.filter(o => o.label === 1 || o.label === true), [allObjects])
  const ngOnlyCount = ngOnlyObjects.length

  // Pre-compute render lists with cavity headers (avoids tracking state in .map())
  const ngRenderList = useMemo(() => {
    const items = []
    let lastCav = -1
    allObjects.forEach((obj, idx) => {
      if (!(obj.label === 1 || obj.label === true)) return
      if (cavityCount > 1 && obj.cavityIndex !== lastCav) {
        items.push({ type: 'header', cavityIndex: obj.cavityIndex, key: `ng-cav-${obj.cavityIndex}` })
        lastCav = obj.cavityIndex
      }
      items.push({ type: 'obj', obj, idx, key: obj.key })
    })
    return items
  }, [allObjects, cavityCount])

  const goodRenderList = useMemo(() => {
    const items = []
    let lastCav = -1
    allObjects.forEach((obj, idx) => {
      if (obj.label === 1 || obj.label === true) return
      if (cavityCount > 1 && obj.cavityIndex !== lastCav) {
        items.push({ type: 'header', cavityIndex: obj.cavityIndex, key: `good-cav-${obj.cavityIndex}` })
        lastCav = obj.cavityIndex
      }
      items.push({ type: 'obj', obj, idx, key: obj.key })
    })
    return items
  }, [allObjects, cavityCount])

  // Per-object review state — start with no object selected (full PCB view)
  const [activeObjectIdx, setActiveObjectIdx] = useState(null)
  // focusTrigger: increment to re-trigger ImageViewer zoom (handles re-click on same object)
  const [focusTrigger, setFocusTrigger] = useState(0)
  // Active frame index for multi-frame navigation (thumbnail strip)
  const [activeFrameIdx, setActiveFrameIdx] = useState(0)
  const [objectDecisions, setObjectDecisions] = useState(initialObjectDecisions)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  // Accordion: 'ng' or 'good' — only one expanded at a time
  const [expandedSection, setExpandedSection] = useState('ng')
  // Bulk action: when true, footer shows reason picker for bulk OK
  const [bulkReasonMode, setBulkReasonMode] = useState(false)
  // Bulk selection: set of object keys selected for bulk action
  const [bulkSelected, setBulkSelected] = useState(() => new Set())

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

  // Bubble up objectDecisions to parent for persistence
  useEffect(() => {
    onObjectDecisionsChange?.(objectDecisions)
  }, [objectDecisions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Select object + trigger ImageViewer zoom (toggle: click same → deselect + reset)
  const handleSelectObject = useCallback((idx) => {
    if (idx === activeObjectIdx) {
      // Toggle off: deselect → ImageViewer resets to fit view
      setActiveObjectIdx(null)
      return
    }
    setActiveObjectIdx(idx)
    setFocusTrigger(prev => prev + 1)
  }, [activeObjectIdx])

  // Reset when inspection changes
  useEffect(() => {
    setActiveObjectIdx(null)
    setFocusTrigger(0)
    setActiveFrameIdx(0)
    setObjectDecisions(initialObjectDecisions)
    setFrameDecisions(initialDecisions)
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
    setExpandedSection('ng')
    setBulkReasonMode(false)
    setBulkSelected(new Set())
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
        setFocusTrigger(prev => prev + 1)
        return
      }
    }
    // Wrap around
    for (let i = 0; i < fromIdx; i++) {
      const isNG = allObjects[i].label === 1 || allObjects[i].label === true
      if (isNG && !allObjDecisions[allObjects[i].key]) {
        setActiveObjectIdx(i)
        setFocusTrigger(prev => prev + 1)
        return
      }
    }
    // All NG objects reviewed — useEffect handles completion
  }, [allObjects])

  // Confirm current object as REAL NG
  const handleObjectNG = useCallback(() => {
    if (hasObjects) {
      // If no object selected yet, select first object instead of confirming
      if (activeObjectIdx == null) { handleSelectObject(0); return }
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
      currentFrame, frameDecisions, reviewIndex, ngFrames, handleSelectObject])

  useEffect(() => { handleObjectNGRef.current = handleObjectNG }, [handleObjectNG])

  const handleObjectGood = useCallback(() => {
    // If no object selected yet, select first object instead
    if (hasObjects && activeObjectIdx == null) { handleSelectObject(0); return }
    if (countdownRef.current) clearInterval(countdownRef.current)
    setShowReasonInput(true)
  }, [hasObjects, activeObjectIdx, handleSelectObject])

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
    handleSelectObject(idx)
    setShowReasonInput(true)
  }, [allObjects, objectDecisions, handleSelectObject])

  // ── Bulk actions ──
  const unreviewed = useMemo(() =>
    ngOnlyObjects.filter(o => objectDecisions[o.key] == null),
    [ngOnlyObjects, objectDecisions]
  )
  const unreviewedCount = unreviewed.length

  // Effective selection: only unreviewed objects that are still selected
  const effectiveBulkSelected = useMemo(() => {
    const unreviewedKeys = new Set(unreviewed.map(o => o.key))
    return new Set([...bulkSelected].filter(k => unreviewedKeys.has(k)))
  }, [bulkSelected, unreviewed])
  const bulkSelectedCount = effectiveBulkSelected.size

  const toggleBulkSelect = useCallback((key) => {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (effectiveBulkSelected.size === unreviewed.length) {
      setBulkSelected(new Set())
    } else {
      setBulkSelected(new Set(unreviewed.map(o => o.key)))
    }
  }, [effectiveBulkSelected.size, unreviewed])

  const handleBulkNG = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    const newDecisions = { ...objectDecisions }
    for (const obj of unreviewed) {
      if (!effectiveBulkSelected.has(obj.key)) continue
      newDecisions[obj.key] = 'REAL_NG'
      const frameKey = `${obj.frameSide}-${obj.frameIndex}`
      onDecisionChange?.(frameKey, 'REAL_NG')
    }
    setObjectDecisions(newDecisions)
    setBulkSelected(new Set())
    setShowReasonInput(false)
    setBulkReasonMode(false)
  }, [objectDecisions, unreviewed, effectiveBulkSelected, onDecisionChange])

  const handleBulkOK = useCallback(() => {
    setBulkReasonMode(true)
    setShowReasonInput(true)
  }, [])

  const handleSubmitBulkFalseCall = useCallback(() => {
    const effectiveReason = selectedReason === 'other' ? otherText.trim() : selectedReason.trim()
    if (!effectiveReason) return
    const newDecisions = { ...objectDecisions }
    for (const obj of unreviewed) {
      if (!effectiveBulkSelected.has(obj.key)) continue
      newDecisions[obj.key] = effectiveReason
      const frameKey = `${obj.frameSide}-${obj.frameIndex}`
      onDecisionChange?.(frameKey, effectiveReason)
    }
    setObjectDecisions(newDecisions)
    setBulkSelected(new Set())
    setShowReasonInput(false)
    setBulkReasonMode(false)
    setSelectedReason('')
    setOtherText('')
  }, [objectDecisions, unreviewed, effectiveBulkSelected, selectedReason, otherText, onDecisionChange])

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
      } else if (hasObjects && (e.key === 'ArrowDown' || e.key === 'ArrowRight') && !e.ctrlKey) {
        e.preventDefault()
        setActiveObjectIdx(prev => prev == null ? 0 : Math.min(allObjects.length - 1, prev + 1))
        setFocusTrigger(prev => prev + 1)
      } else if (hasObjects && (e.key === 'ArrowUp' || e.key === 'ArrowLeft') && !e.ctrlKey) {
        e.preventDefault()
        setActiveObjectIdx(prev => prev == null ? 0 : Math.max(0, prev - 1))
        setFocusTrigger(prev => prev + 1)
      } else if (ngFrames.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowDown') && e.ctrlKey) {
        // Ctrl+Arrow: switch frames
        e.preventDefault()
        setActiveFrameIdx(prev => Math.min(ngFrames.length - 1, prev + 1))
        setActiveObjectIdx(null)
      } else if (ngFrames.length > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowUp') && e.ctrlKey) {
        e.preventDefault()
        setActiveFrameIdx(prev => Math.max(0, prev - 1))
        setActiveObjectIdx(null)
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
        <div className="flex-1 relative min-w-0 min-h-0">
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
                src={currentFrame.image_raw_url || currentFrame.image_url}
                alt={`${currentFrame.side} frame ${currentFrame.frameIndex + 1}`}
                objects={currentFrameObjects}
                activeObjectIndex={hasObjects ? activeObjectFrameIdx : -1}
                focusTrigger={focusTrigger}
                onObjectClick={hasObjects ? (idx) => {
                  // Find the global index for this frame object
                  const clickedKey = currentFrameObjects[idx]?._key
                  if (clickedKey) {
                    const globalIdx = allObjects.findIndex(o => o.key === clickedKey)
                    if (globalIdx !== -1) handleSelectObject(globalIdx)
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

            {/* Frame navigation arrows */}
            {ngFrames.length > 1 && (
              <>
                {activeFrameIdx > 0 && (
                  <button
                    onClick={() => { setActiveFrameIdx(prev => prev - 1); setActiveObjectIdx(null) }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-void/70 backdrop-blur-sm border border-surface-border hover:border-phosphor-teal/50 hover:bg-void/90 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-text-primary" />
                  </button>
                )}
                {activeFrameIdx < ngFrames.length - 1 && (
                  <button
                    onClick={() => { setActiveFrameIdx(prev => prev + 1); setActiveObjectIdx(null) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-void/70 backdrop-blur-sm border border-surface-border hover:border-phosphor-teal/50 hover:bg-void/90 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-text-primary" />
                  </button>
                )}
              </>
            )}
            {/* Frame Thumbnail Strip — overlaid at bottom of image area */}
            {ngFrames.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-void/80 backdrop-blur-sm border border-surface-border/50">
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
                        "relative flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all",
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
                      <span className="absolute top-0 left-0 px-1 text-[9px] font-mono font-bold bg-void/80 text-text-primary rounded-br leading-tight">
                        {frame.side === 'TOP' ? 'TOP' : 'BTM'}
                      </span>
                      {/* SN color bar — matches SidePanel styling */}
                      {snType === SN_TYPE.TIMESTAMP ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2.5 bg-yellow-500/60"
                          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 6px)' }}
                        />
                      ) : snType === SN_TYPE.REAL && sn ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2.5"
                          style={{ backgroundColor: snToColor(sn) }}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        {/* Right — Object list panel (only when objects exist) */}
        {hasObjects && (
          <div className="w-80 flex flex-col shrink-0 bg-terminal border-l border-surface-border overflow-hidden">
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

            {/* Object list — split layout: headers always visible, items scroll */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* ── NG Header (always visible at top) ── */}
              {ngOnlyCount > 0 && (
                <div className="bg-phosphor-red/10 border-b border-surface-border shrink-0">
                  <button
                    onClick={() => setExpandedSection(prev => prev === 'ng' ? null : 'ng')}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-phosphor-red/15 transition-colors"
                  >
                    <span className="text-xxs font-mono text-phosphor-red font-bold">NG ({ngOnlyCount})</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-phosphor-red transition-transform", expandedSection === 'ng' ? "rotate-0" : "-rotate-90")} />
                  </button>
                  {/* Bulk selection bar — only when NG expanded and has unreviewed items */}
                  {expandedSection === 'ng' && unreviewedCount > 0 && (
                    <div className="px-3 pb-1.5 flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer mr-auto" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={bulkSelectedCount === unreviewedCount && unreviewedCount > 0}
                          ref={(el) => { if (el) el.indeterminate = bulkSelectedCount > 0 && bulkSelectedCount < unreviewedCount }}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 accent-phosphor-teal cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-text-tertiary">
                          {bulkSelectedCount > 0 ? `${bulkSelectedCount} selected` : `${unreviewedCount} remaining`}
                        </span>
                      </label>
                      {bulkSelectedCount > 0 && (
                        <>
                          <button
                            onClick={handleBulkOK}
                            className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-phosphor-green/10 border border-phosphor-green/40 text-phosphor-green hover:bg-phosphor-green/25 transition-colors"
                          >
                            OK ({bulkSelectedCount})
                          </button>
                          <button
                            onClick={handleBulkNG}
                            className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-phosphor-red/10 border border-phosphor-red/40 text-phosphor-red hover:bg-phosphor-red/25 transition-colors"
                          >
                            NG ({bulkSelectedCount})
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* ── NG Items (scrollable, fills space when expanded) ── */}
              {expandedSection === 'ng' && ngOnlyCount > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {ngRenderList.map(item => {
                    if (item.type === 'header') {
                      return (
                        <div key={item.key} className="px-3 py-1 bg-void/40 border-b border-surface-border/30 sticky top-0 z-[1]">
                          <span className="text-[10px] font-mono text-phosphor-teal/70 uppercase tracking-wider">
                            PCB {item.cavityIndex + 1}
                          </span>
                        </div>
                      )
                    }
                    const { obj, idx } = item
                    const isActive = idx === activeObjectIdx
                    const decision = objectDecisions[obj.key]
                    const decisionIsNG = decision === 'REAL_NG'
                    const isReviewed = decision != null
                    return (
                      <ObjectRow key={obj.key} obj={obj} idx={idx} isActive={isActive} isObjNG
                        isReviewed={isReviewed} decisionIsNG={decisionIsNG}
                        onSelect={handleSelectObject} onGood={handleInlineGood} onNG={handleInlineNG}
                        showCheckbox={!isReviewed} isChecked={effectiveBulkSelected.has(obj.key)}
                        onToggleCheck={toggleBulkSelect} />
                    )
                  })}
                </div>
              )}
              {/* ── GOOD Header (always visible — floats at bottom when NG expanded) ── */}
              {totalObjects - ngOnlyCount > 0 && (
                <button
                  onClick={() => setExpandedSection(prev => prev === 'good' ? null : 'good')}
                  className="w-full px-3 py-1.5 bg-phosphor-green/10 border-b border-surface-border flex items-center justify-between hover:bg-phosphor-green/15 transition-colors shrink-0"
                >
                  <span className="text-xxs font-mono text-phosphor-green font-bold">GOOD ({totalObjects - ngOnlyCount})</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-phosphor-green transition-transform", expandedSection === 'good' ? "rotate-0" : "-rotate-90")} />
                </button>
              )}
              {/* ── GOOD Items (scrollable, fills space when expanded) ── */}
              {expandedSection === 'good' && totalObjects - ngOnlyCount > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {goodRenderList.map(item => {
                    if (item.type === 'header') {
                      return (
                        <div key={item.key} className="px-3 py-1 bg-void/40 border-b border-surface-border/30 sticky top-0 z-[1]">
                          <span className="text-[10px] font-mono text-phosphor-green/60 uppercase tracking-wider">
                            PCB {item.cavityIndex + 1}
                          </span>
                        </div>
                      )
                    }
                    const { obj, idx } = item
                    const isActive = idx === activeObjectIdx
                    return (
                      <ObjectRow key={obj.key} obj={obj} idx={idx} isActive={isActive} isObjNG={false}
                        isReviewed={false} decisionIsNG={false}
                        onSelect={handleSelectObject} />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Reason input / Status — pinned at bottom of side panel */}
            {showReasonInput ? (
              <div className="px-3 py-2 border-t border-surface-border shrink-0 space-y-2">
                {bulkReasonMode && (
                  <span className="text-xxs font-mono text-phosphor-cyan">
                    {bulkSelectedCount} objects
                  </span>
                )}
                {selectedReason === 'other' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setSelectedReason(''); setOtherText('') }}
                      className="h-8 px-2 bg-elevated border border-surface-border rounded text-text-secondary font-mono text-xs hover:border-phosphor-teal/50 transition-colors flex-shrink-0"
                    >
                      &larr;
                    </button>
                    <input
                      type="text"
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (bulkReasonMode ? handleSubmitBulkFalseCall : handleSubmitFalseCall)() }}
                      placeholder={t('cavityReview.typeOtherReason')}
                      autoFocus
                      className="flex-1 h-8 px-2 bg-elevated border border-surface-border rounded text-text-primary text-xs font-mono placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-phosphor-green"
                    />
                  </div>
                ) : (
                  <select
                    value={selectedReason}
                    onChange={(e) => { setSelectedReason(e.target.value); setOtherText('') }}
                    autoFocus
                    className="w-full h-8 px-2 bg-elevated border border-surface-border rounded text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-phosphor-green"
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
                <div className="flex gap-1.5">
                  <button onClick={bulkReasonMode ? handleSubmitBulkFalseCall : handleSubmitFalseCall}
                    disabled={selectedReason === 'other' ? !otherText.trim() : !selectedReason.trim()}
                    className="flex-1 h-8 bg-phosphor-green text-void font-display font-bold text-xs rounded hover:bg-phosphor-green-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    {t('falseCall.submit')}
                  </button>
                  <button onClick={() => { handleCancelReason(); setBulkReasonMode(false) }}
                    className="h-8 px-3 bg-elevated border border-surface-border text-text-secondary font-display font-bold text-xs rounded hover:border-phosphor-teal/50 transition-colors">
                    {t('falseCall.cancel')}
                  </button>
                </div>
              </div>
            ) : reviewedCount === totalReviewable && reviewedCount > 0 ? (
              <div className="px-3 py-2 border-t border-surface-border shrink-0 text-center">
                <span className="font-mono text-xs text-phosphor-cyan animate-pulse">
                  {t('cavityReview.allReviewed')}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default CavityReviewOverlay

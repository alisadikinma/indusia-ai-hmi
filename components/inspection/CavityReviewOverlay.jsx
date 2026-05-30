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
import { findNextUnreviewedFrame, computePcbCounts, normalizeBox, deduplicateContainedObjects } from '@/lib/utils/inspectionReview'
import { classifySerialNumber, isRealPcb, SN_TYPE } from '@/lib/utils/serialNumber'
import { X, Timer, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react'
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
    if (obj.isSubBox) return // Sub-boxes follow parent decision
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

/** Sub-box child row — clickable to zoom to sub-region */
function SubBoxRow({ subBox, globalIdx, isActive, onSelect }) {
  return (
    <div
      onClick={() => onSelect(globalIdx)}
      className={cn(
        "pl-8 pr-3 py-1 cursor-pointer transition-all border-l-2",
        isActive
          ? "bg-phosphor-teal/10 border-l-phosphor-teal"
          : "border-l-surface-border/30 hover:bg-elevated/30"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full shrink-0 bg-phosphor-cyan/50" />
        <span className={cn(
          "text-[10px] font-mono truncate",
          isActive ? "text-phosphor-teal" : "text-text-secondary"
        )}>
          {subBox.name}
        </span>
      </div>
      {subBox.box && subBox.box.length >= 4 && (() => {
        const [nx1, ny1, nx2, ny2] = normalizeBox(subBox.box)
        return (
          <span className="text-[9px] text-text-tertiary/60 font-mono block ml-4">
            [{Math.round(nx1)}, {Math.round(ny1)}, {Math.round(nx2)}, {Math.round(ny2)}]
          </span>
        )
      })()}
    </div>
  )
}

/** Single object row — extracted for accordion reuse */
function ObjectRow({ obj, idx, isActive, isObjNG, isReviewed, decisionIsNG, onSelect, onGood, onNG, showCheckbox, isChecked, onToggleCheck, subBoxes, allObjects, activeObjectIdx }) {
  const [expanded, setExpanded] = useState(false)
  const hasSubBoxes = subBoxes && subBoxes.length > 0

  return (
    <>
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
                : "border-l-surface-border hover:bg-elevated/50"
        )}
      >
        <div className="flex items-center gap-2">
          {hasSubBoxes && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev) }}
              className="p-0 shrink-0"
            >
              <ChevronDown className={cn("w-3.5 h-3.5 text-text-tertiary transition-transform", expanded ? "rotate-0" : "-rotate-90")} />
            </button>
          )}
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
              {hasSubBoxes && (
                <span className="text-[9px] font-mono text-phosphor-cyan/60 shrink-0">
                  {subBoxes.length}
                </span>
              )}
            </div>
            {obj.box && obj.box.length >= 4 && (() => {
              const [nx1, ny1, nx2, ny2] = normalizeBox(obj.box)
              return (
                <span className={cn("text-[9px] text-text-tertiary/60 font-mono block ml-3")}>
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
      {/* Sub-box children — expandable */}
      {hasSubBoxes && expanded && subBoxes.map(subBoxKey => {
        const subGlobalIdx = allObjects.findIndex(o => o.key === subBoxKey)
        if (subGlobalIdx === -1) return null
        const sub = allObjects[subGlobalIdx]
        return (
          <SubBoxRow
            key={subBoxKey}
            subBox={sub}
            globalIdx={subGlobalIdx}
            isActive={subGlobalIdx === activeObjectIdx}
            onSelect={onSelect}
          />
        )
      })}
    </>
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

  // Flatten all objects across all NG frames, sorted: NG first (by Y,X coords), then GOOD.
  // Sub-box children from attrs.boxes are included as separate entries with isSubBox flag.
  const allObjects = useMemo(() => {
    const result = []
    ngFrames.forEach(frame => {
      (frame.objects || []).forEach((obj, objIdx) => {
        const parentKey = objKey(frame.side, frame.frameIndex, objIdx)
        const subBoxes = obj.attrs?.boxes || []
        const subBoxKeys = subBoxes.map((_, subIdx) => `${parentKey}-SUB-${subIdx}`)

        result.push({
          ...obj,
          frameSide: frame.side,
          frameIndex: frame.frameIndex,
          objectIndex: objIdx,
          serialNumber: frame.serial_number,
          imageUrl: frame.image_url,
          key: parentKey,
          cavityIndex: 0,
          subBoxKeys: subBoxKeys.length > 0 ? subBoxKeys : undefined,
        })

        // Add sub-box children
        subBoxes.forEach((subBox, subIdx) => {
          if (!subBox || subBox.length < 4) return
          result.push({
            name: `${obj.name}.${subIdx + 1}`,
            box: subBox,
            label: obj.label,
            score: null,
            attrs: null,
            frameSide: frame.side,
            frameIndex: frame.frameIndex,
            objectIndex: objIdx,
            serialNumber: frame.serial_number,
            imageUrl: frame.image_url,
            key: `${parentKey}-SUB-${subIdx}`,
            cavityIndex: 0,
            isSubBox: true,
            parentKey,
            subBoxIndex: subIdx,
          })
        })
      })
    })

    // Containment deduplication: remove individual pin detections that are
    // contained within a larger same-name component (e.g. connector pins vs connector).
    // Applied per-frame so pins from one frame don't suppress objects in another.
    {
      const parentByFrame = new Map()
      result.forEach(obj => {
        if (obj.isSubBox) return
        const fk = `${obj.frameSide}-${obj.frameIndex}`
        if (!parentByFrame.has(fk)) parentByFrame.set(fk, [])
        parentByFrame.get(fk).push(obj)
      })

      const removedKeys = new Set()
      parentByFrame.forEach(frameObjs => {
        const kept = deduplicateContainedObjects(frameObjs)
        const keptKeys = new Set(kept.map(o => o.key))
        frameObjs.forEach(o => { if (!keptKeys.has(o.key)) removedKeys.add(o.key) })
      })

      if (removedKeys.size > 0) {
        // Remove filtered parents and their orphaned sub-boxes
        const filtered = result.filter(o =>
          o.isSubBox ? !removedKeys.has(o.parentKey) : !removedKeys.has(o.key)
        )
        result.length = 0
        filtered.forEach(o => result.push(o))
      }
    }

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
    // Sub-boxes must stay immediately after their parent, so sort parents only,
    // then interleave sub-boxes after each parent.
    const isNG = o => o.label === 1 || o.label === true
    const parents = result.filter(o => !o.isSubBox)
    const subsByParent = new Map()
    result.forEach(o => {
      if (!o.isSubBox) return
      if (!subsByParent.has(o.parentKey)) subsByParent.set(o.parentKey, [])
      subsByParent.get(o.parentKey).push(o)
    })

    parents.sort((a, b) => {
      const aNg = isNG(a) ? 0 : 1
      const bNg = isNG(b) ? 0 : 1
      if (aNg !== bNg) return aNg - bNg
      if (a.cavityIndex !== b.cavityIndex) return a.cavityIndex - b.cavityIndex
      const [ax1, ay1] = normalizeBox(a.box || [0,0,0,0])
      const [bx1, by1] = normalizeBox(b.box || [0,0,0,0])
      return ay1 - by1 || ax1 - bx1
    })

    // Rebuild with sub-boxes interleaved after their parent
    const sorted = []
    parents.forEach(parent => {
      sorted.push(parent)
      const subs = subsByParent.get(parent.key)
      if (subs) sorted.push(...subs)
    })
    return sorted
  }, [ngFrames, cavityCount])

  // Parent objects only (exclude sub-boxes from counting)
  const parentObjects = useMemo(() => allObjects.filter(o => !o.isSubBox), [allObjects])
  const totalObjects = parentObjects.length
  // Fall back to per-frame review if no objects detected (legacy data)
  const hasObjects = totalObjects > 0
  // Only NG parent objects (label=1/true) need operator review, GOOD objects are auto-OK
  // Sub-boxes are excluded — they follow parent's decision
  const ngOnlyObjects = useMemo(() => allObjects.filter(o => !o.isSubBox && (o.label === 1 || o.label === true)), [allObjects])
  const ngOnlyCount = ngOnlyObjects.length

  // Active frame index for multi-frame navigation (thumbnail strip)
  // Declared early because render lists below depend on it
  const [activeFrameIdx, setActiveFrameIdx] = useState(0)

  // Pre-compute render lists with cavity headers (avoids tracking state in .map())
  // Sub-boxes excluded from render lists — they're rendered as children inside ObjectRow
  // Filter by active frame so list changes when switching thumbnails
  const activeFrameSide = ngFrames[activeFrameIdx]?.side
  const activeFrameIndex = ngFrames[activeFrameIdx]?.frameIndex

  // Per-frame counts for display in section headers
  const frameParentObjects = useMemo(() => parentObjects.filter(
    o => o.frameSide === activeFrameSide && o.frameIndex === activeFrameIndex
  ), [parentObjects, activeFrameSide, activeFrameIndex])
  const frameObjectCount = frameParentObjects.length
  const frameNgCount = useMemo(() => frameParentObjects.filter(
    o => o.label === 1 || o.label === true
  ).length, [frameParentObjects])
  const frameGoodCount = frameObjectCount - frameNgCount

  const ngRenderList = useMemo(() => {
    // Count NG parent objects per cavity for header badges
    const cavityCounts = {}
    allObjects.forEach(obj => {
      if (obj.isSubBox) return
      if (!(obj.label === 1 || obj.label === true)) return
      if (obj.frameSide !== activeFrameSide || obj.frameIndex !== activeFrameIndex) return
      cavityCounts[obj.cavityIndex] = (cavityCounts[obj.cavityIndex] || 0) + 1
    })
    const items = []
    let lastCav = -1
    allObjects.forEach((obj, idx) => {
      if (obj.isSubBox) return
      if (!(obj.label === 1 || obj.label === true)) return
      if (obj.frameSide !== activeFrameSide || obj.frameIndex !== activeFrameIndex) return
      if (cavityCount > 1 && obj.cavityIndex !== lastCav) {
        items.push({ type: 'header', cavityIndex: obj.cavityIndex, count: cavityCounts[obj.cavityIndex] || 0, key: `ng-cav-${obj.cavityIndex}` })
        lastCav = obj.cavityIndex
      }
      items.push({ type: 'obj', obj, idx, key: obj.key })
    })
    return items
  }, [allObjects, cavityCount, activeFrameSide, activeFrameIndex])

  const goodRenderList = useMemo(() => {
    const cavityCounts = {}
    allObjects.forEach(obj => {
      if (obj.isSubBox) return
      if (obj.label === 1 || obj.label === true) return
      if (obj.frameSide !== activeFrameSide || obj.frameIndex !== activeFrameIndex) return
      cavityCounts[obj.cavityIndex] = (cavityCounts[obj.cavityIndex] || 0) + 1
    })
    const items = []
    let lastCav = -1
    allObjects.forEach((obj, idx) => {
      if (obj.isSubBox) return
      if (obj.label === 1 || obj.label === true) return
      if (obj.frameSide !== activeFrameSide || obj.frameIndex !== activeFrameIndex) return
      if (cavityCount > 1 && obj.cavityIndex !== lastCav) {
        items.push({ type: 'header', cavityIndex: obj.cavityIndex, count: cavityCounts[obj.cavityIndex] || 0, key: `good-cav-${obj.cavityIndex}` })
        lastCav = obj.cavityIndex
      }
      items.push({ type: 'obj', obj, idx, key: obj.key })
    })
    return items
  }, [allObjects, cavityCount, activeFrameSide, activeFrameIndex])

  // Per-object review state — start with no object selected (full PCB view)
  const [activeObjectIdx, setActiveObjectIdx] = useState(null)
  // focusTrigger: increment to re-trigger ImageViewer zoom (handles re-click on same object)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [objectDecisions, setObjectDecisions] = useState(initialObjectDecisions)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  // Accordion: 'ng' or 'good' — only one expanded at a time
  const [expandedSection, setExpandedSection] = useState('ng')
  // Collapsible PCB groups — exclusive accordion (only one PCB open at a time per section)
  const [expandedPcb, setExpandedPcb] = useState(() => {
    const firstCav = ngRenderList.find(item => item.type === 'header')
    return firstCav != null ? firstCav.cavityIndex : 0
  })
  const [expandedGoodPcb, setExpandedGoodPcb] = useState(() => {
    const firstCav = goodRenderList.find(item => item.type === 'header')
    return firstCav != null ? firstCav.cavityIndex : 0
  })
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

  // Objects in the current frame for ImageViewer coordinate-based zoom.
  // Includes both parent objects and sub-boxes (sub-boxes appended at end).
  // ImageViewer no longer renders bboxes, but needs coordinates for auto-zoom.
  const currentFrameObjects = useMemo(() => {
    if (!currentFrame) return []
    const frameObjs = (currentFrame.objects || []).map((obj, idx) => ({
      name: obj.name,
      box: obj.box,
      score: obj.score,
      label: obj.label,
      _key: objKey(currentFrame.side, currentFrame.frameIndex, idx),
    }))
    // Append sub-box entries for this frame (so ImageViewer can zoom to them)
    allObjects.forEach(obj => {
      if (!obj.isSubBox) return
      if (obj.frameSide !== currentFrame.side || obj.frameIndex !== currentFrame.frameIndex) return
      frameObjs.push({
        name: obj.name,
        box: obj.box,
        score: null,
        label: obj.label,
        _key: obj.key,
      })
    })
    return frameObjs
  }, [currentFrame, allObjects])

  // Active object index within the frame objects array (for ImageViewer auto-zoom).
  // Returns -1 when no object selected → ImageViewer shows full PCB without zoom.
  // For sub-boxes, finds their position in currentFrameObjects by key lookup.
  const activeObjectFrameIdx = useMemo(() => {
    if (activeObjectIdx == null || !activeObject || !currentFrame) return -1
    // Find the object in currentFrameObjects by its key
    const targetKey = activeObject.key
    const frameIdx = currentFrameObjects.findIndex(o => o._key === targetKey)
    return frameIdx !== -1 ? frameIdx : activeObject.objectIndex
  }, [activeObjectIdx, activeObject, currentFrame, currentFrameObjects])

  // Bubble up objectDecisions to parent for persistence
  useEffect(() => {
    onObjectDecisionsChange?.(objectDecisions)
  }, [objectDecisions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Select object + trigger ImageViewer zoom (toggle: click same → deselect + reset)
  // Also toggles bulk checkbox so click = select + tick, click again = deselect + untick.
  // If the selected object belongs to a different frame, switch activeFrameIdx first
  // so ImageViewer loads the correct image before auto-zoom fires.
  const handleSelectObject = useCallback((idx) => {
    const obj = allObjects[idx]
    if (idx === activeObjectIdx) {
      // Toggle off: deselect → ImageViewer resets to fit view, untick checkbox
      setActiveObjectIdx(null)
      if (obj) setBulkSelected(prev => { const next = new Set(prev); next.delete(obj.key); return next })
      return
    }
    // Sync frame if object is on a different frame than currently displayed
    if (obj) {
      const targetFrameIdx = ngFrames.findIndex(
        f => f.side === obj.frameSide && f.frameIndex === obj.frameIndex
      )
      if (targetFrameIdx !== -1 && targetFrameIdx !== activeFrameIdx) {
        setActiveFrameIdx(targetFrameIdx)
      }
    }
    setActiveObjectIdx(idx)
    setFocusTrigger(prev => prev + 1)
    // Auto-tick checkbox on select
    if (obj) setBulkSelected(prev => { const next = new Set(prev); next.add(obj.key); return next })
  }, [activeObjectIdx, allObjects, ngFrames, activeFrameIdx])

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
    // Reset collapsible PCBs — expand only the first cavity
    const firstNgCav = ngRenderList.find(item => item.type === 'header')
    setExpandedPcb(firstNgCav != null ? firstNgCav.cavityIndex : 0)
    const firstGoodCav = goodRenderList.find(item => item.type === 'header')
    setExpandedGoodPcb(firstGoodCav != null ? firstGoodCav.cavityIndex : 0)
  }, [inspection]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand PCB group when active object advances into a different group
  useEffect(() => {
    if (activeObjectIdx == null || cavityCount <= 1) return
    const obj = allObjects[activeObjectIdx]
    if (!obj) return
    setExpandedPcb(prev => prev === obj.cavityIndex ? prev : obj.cavityIndex)
  }, [activeObjectIdx, allObjects, cavityCount])

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

  // Find next unreviewed NG parent object (skip GOOD objects and sub-boxes).
  // Priority 1: Stay within the current frame (search forward, then wrap within frame).
  // Priority 2: Only cross to another frame when all NG objects in current frame are done.
  // When crossing frames, also updates activeFrameIdx so the objects list stays in sync.
  const advanceToNextObject = useCallback((allObjDecisions, fromIdx) => {
    const justConfirmedObj = allObjects[fromIdx - 1]
    const currSide = justConfirmedObj?.frameSide
    const currFrameIdx = justConfirmedObj?.frameIndex

    const isUnreviewedNG = (obj) =>
      !obj.isSubBox &&
      (obj.label === 1 || obj.label === true) &&
      !allObjDecisions[obj.key]

    // Priority 1: Search forward within the same frame
    for (let i = fromIdx; i < allObjects.length; i++) {
      const obj = allObjects[i]
      if (obj.frameSide === currSide && obj.frameIndex === currFrameIdx && isUnreviewedNG(obj)) {
        setActiveObjectIdx(i)
        setFocusTrigger(prev => prev + 1)
        return
      }
    }
    // Priority 1b: Wrap-around within the same frame (before fromIdx)
    for (let i = 0; i < fromIdx; i++) {
      const obj = allObjects[i]
      if (obj.frameSide === currSide && obj.frameIndex === currFrameIdx && isUnreviewedNG(obj)) {
        setActiveObjectIdx(i)
        setFocusTrigger(prev => prev + 1)
        return
      }
    }

    // Priority 2: Current frame fully reviewed — find next frame with unreviewed NGs
    for (let fi = 0; fi < ngFrames.length; fi++) {
      const frame = ngFrames[fi]
      if (frame.side === currSide && frame.frameIndex === currFrameIdx) continue
      for (let i = 0; i < allObjects.length; i++) {
        const obj = allObjects[i]
        if (obj.frameSide === frame.side && obj.frameIndex === frame.frameIndex && isUnreviewedNG(obj)) {
          setActiveFrameIdx(fi)
          setActiveObjectIdx(i)
          setFocusTrigger(prev => prev + 1)
          return
        }
      }
    }
    // All NG objects reviewed — useEffect handles completion
  }, [allObjects, ngFrames])

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
      // Expand all PCB groups so selected items are visible
      setExpandedPcb('all')
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

  // Auto-hide reason dropdown when target is gone:
  // - Bulk mode: all checkboxes unticked
  // - Single mode: active object deselected
  useEffect(() => {
    if (!showReasonInput) return
    if (bulkReasonMode) {
      if (effectiveBulkSelected.size === 0) {
        setBulkReasonMode(false)
        setShowReasonInput(false)
        setSelectedReason('')
        setOtherText('')
      }
    } else if (activeObjectIdx == null) {
      setShowReasonInput(false)
      setSelectedReason('')
      setOtherText('')
    }
  }, [showReasonInput, bulkReasonMode, effectiveBulkSelected.size, activeObjectIdx])

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
        // Skip sub-boxes in keyboard navigation — only navigate parent objects
        setActiveObjectIdx(prev => {
          let next = prev == null ? 0 : prev + 1
          while (next < allObjects.length && allObjects[next]?.isSubBox) next++
          return Math.min(allObjects.length - 1, next)
        })
        setFocusTrigger(prev => prev + 1)
      } else if (hasObjects && (e.key === 'ArrowUp' || e.key === 'ArrowLeft') && !e.ctrlKey) {
        e.preventDefault()
        setActiveObjectIdx(prev => {
          let next = prev == null ? 0 : prev - 1
          while (next >= 0 && allObjects[next]?.isSubBox) next--
          return Math.max(0, next)
        })
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

            {currentFrame && currentFrame.image_url ? (
              <ImageViewer
                src={currentFrame.image_url}
                alt={`${currentFrame.side} frame ${currentFrame.frameIndex + 1}`}
                objects={currentFrameObjects}
                activeObjectIndex={hasObjects ? activeObjectFrameIdx : -1}
                focusTrigger={focusTrigger}
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
            {/* Frame Thumbnail Strip — above zoom controls, horizontally scrollable */}
            {ngFrames.length > 1 && (
              <div className="absolute bottom-12 left-3 right-3 z-20 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-void/80 backdrop-blur-sm border border-surface-border/50 overflow-x-auto max-w-full">
                {ngFrames.map((frame, fIdx) => {
                  const isActiveFrame = currentFrame === frame
                  const sn = frame.serial_number
                  const snType = classifySerialNumber(sn)
                  const frameImgUrl = frame.image_url

                  // Per-frame confirmation status
                  const frameNgObjs = parentObjects.filter(
                    o => (o.label === 1 || o.label === true) &&
                         o.frameSide === frame.side &&
                         o.frameIndex === frame.frameIndex
                  )
                  const frameNgCount = frameNgObjs.length
                  const frameConfirmedCount = frameNgObjs.filter(o => objectDecisions[o.key] != null).length
                  const frameFullyConfirmed = frameNgCount > 0 && frameConfirmedCount === frameNgCount
                  const frameHasUnreviewed = frameNgCount > 0 && frameConfirmedCount < frameNgCount

                  return (
                    <button
                      key={`${frame.side}-${frame.frameIndex}`}
                      onClick={() => { setActiveFrameIdx(fIdx); setActiveObjectIdx(null) }}
                      className={cn(
                        "relative flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all",
                        isActiveFrame
                          ? "border-phosphor-teal ring-1 ring-phosphor-teal/40"
                          : frameHasUnreviewed
                            ? "border-phosphor-red/70 hover:border-phosphor-red"
                            : frameFullyConfirmed
                              ? "border-phosphor-green/70 hover:border-phosphor-green"
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
                      {/* Confirmation status badge */}
                      {frameNgCount > 0 && (
                        <div className={cn(
                          "absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                          frameFullyConfirmed ? "bg-phosphor-green" : "bg-phosphor-red"
                        )}>
                          {frameFullyConfirmed
                            ? <CheckCircle2 className="w-3 h-3 text-white" />
                            : <AlertCircle className="w-3 h-3 text-white" />
                          }
                        </div>
                      )}
                      {/* SN color bar — matches SidePanel styling */}
                      {snType === SN_TYPE.TIMESTAMP ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2.5 bg-yellow-500/60"
                          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 6px)' }}
                        />
                      ) : snType === SN_TYPE.BARCODE && sn ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2.5"
                          style={{ backgroundColor: snToColor(sn) }}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
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
                  Objects ({frameObjectCount})
                </h3>
                <div className="flex items-center gap-2">
                  {frameNgCount > 0 && (
                    <span className="text-xxs font-mono text-phosphor-red">{frameNgCount} NG</span>
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
              {frameNgCount > 0 && (
                <div className="bg-phosphor-red/10 border-b border-surface-border shrink-0">
                  <button
                    onClick={() => setExpandedSection(prev => prev === 'ng' ? null : 'ng')}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-phosphor-red/15 transition-colors"
                  >
                    <span className="text-xxs font-mono text-phosphor-red font-bold">NG ({frameNgCount})</span>
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
              {expandedSection === 'ng' && frameNgCount > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {ngRenderList.map(item => {
                    if (item.type === 'header') {
                      const isExpanded = expandedPcb === 'all' || expandedPcb === item.cavityIndex
                      return (
                        <button
                          key={item.key}
                          onClick={() => setExpandedPcb(prev => prev === item.cavityIndex ? null : item.cavityIndex)}
                          className="w-full px-3 py-1.5 bg-void/40 border-b border-surface-border/30 sticky top-0 z-[1] flex items-center gap-1.5 hover:bg-elevated/40 transition-colors cursor-pointer"
                        >
                          <ChevronDown className={cn("w-3 h-3 text-phosphor-teal/70 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />
                          <span className="text-[10px] font-mono text-phosphor-teal/70 uppercase tracking-wider">
                            PCB {item.cavityIndex + 1}
                          </span>
                          <span className="text-[9px] font-mono text-text-tertiary/50">({item.count})</span>
                        </button>
                      )
                    }
                    // Hide objects when their PCB group is collapsed
                    if (cavityCount > 1 && expandedPcb !== 'all' && expandedPcb !== item.obj.cavityIndex) return null
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
                        onToggleCheck={toggleBulkSelect}
                        subBoxes={obj.subBoxKeys} allObjects={allObjects} activeObjectIdx={activeObjectIdx} />
                    )
                  })}
                </div>
              )}
              {/* ── GOOD Header (always visible — floats at bottom when NG expanded) ── */}
              {frameGoodCount > 0 && (
                <button
                  onClick={() => setExpandedSection(prev => prev === 'good' ? null : 'good')}
                  className="w-full px-3 py-1.5 bg-phosphor-green/10 border-b border-surface-border flex items-center justify-between hover:bg-phosphor-green/15 transition-colors shrink-0"
                >
                  <span className="text-xxs font-mono text-phosphor-green font-bold">GOOD ({frameGoodCount})</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-phosphor-green transition-transform", expandedSection === 'good' ? "rotate-0" : "-rotate-90")} />
                </button>
              )}
              {/* ── GOOD Items (scrollable, fills space when expanded) ── */}
              {expandedSection === 'good' && frameGoodCount > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {goodRenderList.map(item => {
                    if (item.type === 'header') {
                      const isExpanded = expandedGoodPcb === item.cavityIndex
                      return (
                        <button
                          key={item.key}
                          onClick={() => setExpandedGoodPcb(prev => prev === item.cavityIndex ? null : item.cavityIndex)}
                          className="w-full px-3 py-1.5 bg-void/40 border-b border-surface-border/30 sticky top-0 z-[1] flex items-center gap-1.5 hover:bg-elevated/40 transition-colors cursor-pointer"
                        >
                          <ChevronDown className={cn("w-3 h-3 text-text-tertiary transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />
                          <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                            PCB {item.cavityIndex + 1}
                          </span>
                          <span className="text-[9px] font-mono text-text-tertiary/50">({item.count})</span>
                        </button>
                      )
                    }
                    if (cavityCount > 1 && expandedGoodPcb !== item.obj.cavityIndex) return null
                    const { obj, idx } = item
                    const isActive = idx === activeObjectIdx
                    return (
                      <ObjectRow key={obj.key} obj={obj} idx={idx} isActive={isActive} isObjNG={false}
                        isReviewed={false} decisionIsNG={false}
                        onSelect={handleSelectObject}
                        subBoxes={obj.subBoxKeys} allObjects={allObjects} activeObjectIdx={activeObjectIdx} />
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

'use client'

/**
 * CavityReviewOverlay V2
 * Full-screen overlay for reviewing NG frames one by one.
 *
 * Flow:
 * 1. Collect all NG frames (label=true) from TOP + BOTTOM sides
 * 2. Show one NG frame at a time with GOOD/NG buttons
 * 3. GOOD = false call (needs reason) → user_confirmation = "<reason>"
 * 4. NG = real NG (confirm immediately) → user_confirmation = "REAL NG"
 * 5. After all NG frames reviewed, determine board decision:
 *    - Any REAL NG → board = NG
 *    - All false calls → board = GOOD
 * 6. Keyboard shortcuts: G = GOOD, N = NG
 * 7. Auto-NG countdown resets per frame
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { findNextUnreviewedFrame, computePcbCounts } from '@/lib/utils/inspectionReview'
import { classifySerialNumber, formatSerialDisplay, SN_TYPE } from '@/lib/utils/serialNumber'
import { X, ZoomIn, ZoomOut, CheckCircle2, AlertCircle, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'

const AUTO_NG_DELAY_MS = 10000 // 10 seconds per frame

export function CavityReviewOverlay({
  inspection,
  queuePosition,    // e.g. 3
  queueTotal,       // e.g. 6
  autoNgEnabled,
  onConfirmNG,      // (falseCallInfo?) => void — board-level NG; falseCallInfo={reason,decisions} if mixed
  onConfirmGood,    // (reason) => void — board-level: all NG frames were false calls
  onClose,          // () => void — manual close (optional)
  falseCallReasons = [],
  initialFrameIndex = 0, // Start at a specific NG frame (for thumbnail click)
  initialDecisions = {}, // Persisted decisions from parent (survives modal close/reopen)
  onDecisionChange,      // (key, value) => void — sync each decision to parent immediately
  cavityCount = 0,       // Number of physical PCBs per panel (for correct frame-to-PCB grouping)
  topFrameCount = 0,     // DB-configured TOP frame count (primary source for frame-to-PCB grouping)
  bottomFrameCount = 0,  // DB-configured BOTTOM frame count (primary source for frame-to-PCB grouping)
}) {
  const boardSerialNumber = inspection?.serialNumber || 'N/A'
  const { t } = useI18n()

  // Collect all NG frames from both sides into a flat review list
  // Use loose equality (== true) because backend may send label as boolean true OR integer 1
  const ngFrames = useMemo(() => {
    const topFrames = inspection?.results?.top || []
    const bottomFrames = inspection?.results?.bottom || []
    const frames = []
    topFrames.forEach((f, idx) => {
      if (f.label == true) frames.push({ ...f, side: 'TOP', frameIndex: idx })
    })
    bottomFrames.forEach((f, idx) => {
      if (f.label == true) frames.push({ ...f, side: 'BOTTOM', frameIndex: idx })
    })
    return frames
  }, [inspection])

  const totalNGFrames = ngFrames.length

  // Per-frame review state
  const [reviewIndex, setReviewIndex] = useState(0)
  const [decisions, setDecisions] = useState(initialDecisions) // { 'TOP-0': 'REAL_NG', 'BOTTOM-1': 'some reason' }
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [zoom, setZoom] = useState(1)

  // Auto-NG countdown
  const [countdown, setCountdown] = useState(AUTO_NG_DELAY_MS / 1000)
  const countdownRef = useRef(null)

  // Ref for the auto-NG handler (avoids stale closure in setInterval)
  const handleFrameNGRef = useRef(null)

  const currentFrame = ngFrames[reviewIndex]

  // Reset review state when inspection changes
  useEffect(() => {
    setReviewIndex(initialFrameIndex)
    setDecisions(initialDecisions)
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
    setZoom(1)
  }, [inspection]) // eslint-disable-line react-hooks/exhaustive-deps

  // Finalize board decision after all NG frames reviewed
  // Compute per-PCB counts (TOP+BOTTOM with same serial_number = 1 PCB)
  const completeReview = useCallback((allDecisions) => {
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
      onConfirmNG?.({
        reason: hasFalseCall ? firstReason : null,
        decisions: hasFalseCall ? allDecisions : null,
        pcbCounts,
      })
    } else {
      // All NG frames were marked as false calls → board is GOOD
      const firstReason = Object.values(allDecisions).find(d => d !== 'REAL_NG') || ''
      onConfirmGood?.(firstReason, allDecisions, pcbCounts)
    }
  }, [onConfirmNG, onConfirmGood, ngFrames, inspection, cavityCount, topFrameCount, bottomFrameCount])

  // Auto-complete when all NG frames have been reviewed
  const completeReviewRef = useRef(null)
  completeReviewRef.current = completeReview
  useEffect(() => {
    const reviewedCount = Object.keys(decisions).length
    if (reviewedCount > 0 && reviewedCount === totalNGFrames) {
      // Small delay so the user sees the last decision badge before closing
      const timer = setTimeout(() => {
        completeReviewRef.current?.(decisions)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [decisions, totalNGFrames])

  // Advance to next unreviewed NG frame.
  // When ALL frames are reviewed, the useEffect auto-complete above handles
  // finalization with an 800ms delay (so the user sees the last decision badge).
  const advanceOrComplete = useCallback((allDecisions, nextIndex) => {
    const nextIdx = findNextUnreviewedFrame(ngFrames, allDecisions, nextIndex)
    if (nextIdx === -1) return // all reviewed → useEffect handles completion
    setReviewIndex(nextIdx)
    setZoom(1)
  }, [ngFrames])

  // Confirm current frame as REAL NG
  const handleFrameNG = useCallback(() => {
    if (!currentFrame) return
    if (countdownRef.current) clearInterval(countdownRef.current)

    const key = `${currentFrame.side}-${currentFrame.frameIndex}`
    const newDecisions = { ...decisions, [key]: 'REAL_NG' }
    setDecisions(newDecisions)
    onDecisionChange?.(key, 'REAL_NG')
    setShowReasonInput(false)
    setSelectedReason('')
    advanceOrComplete(newDecisions, reviewIndex + 1)
  }, [currentFrame, decisions, reviewIndex, advanceOrComplete, onDecisionChange])

  // Keep ref in sync for auto-NG timer
  useEffect(() => {
    handleFrameNGRef.current = handleFrameNG
  }, [handleFrameNG])

  // Start false call flow (show reason input)
  const handleFrameGood = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setShowReasonInput(true)
  }, [])

  // Submit false call reason for current frame
  const handleSubmitFalseCall = useCallback(() => {
    const effectiveReason = selectedReason === 'other' ? otherText.trim() : selectedReason.trim()
    if (!effectiveReason || !currentFrame) return

    const key = `${currentFrame.side}-${currentFrame.frameIndex}`
    const newDecisions = { ...decisions, [key]: effectiveReason }
    setDecisions(newDecisions)
    onDecisionChange?.(key, effectiveReason)
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
    advanceOrComplete(newDecisions, reviewIndex + 1)
  }, [currentFrame, decisions, reviewIndex, selectedReason, otherText, advanceOrComplete, onDecisionChange])

  const handleCancelReason = useCallback(() => {
    setShowReasonInput(false)
    setSelectedReason('')
    setOtherText('')
  }, [])

  // Per-frame auto-NG countdown (resets when reviewIndex changes)
  useEffect(() => {
    if (!autoNgEnabled || showReasonInput || !currentFrame) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }

    setCountdown(AUTO_NG_DELAY_MS / 1000)

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          handleFrameNGRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [autoNgEnabled, showReasonInput, reviewIndex, currentFrame])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showReasonInput) return
      const key = decisions[currentFrame ? `${currentFrame.side}-${currentFrame.frameIndex}` : '']
      if (key != null) return // Already reviewed, don't intercept

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleFrameNGRef.current?.()
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        handleFrameGood()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setReviewIndex(prev => Math.max(0, prev - 1))
        setZoom(1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setReviewIndex(prev => Math.min(ngFrames.length - 1, prev + 1))
        setZoom(1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showReasonInput, currentFrame, decisions, handleFrameGood, onClose])

  if (!inspection || !currentFrame) return null

  const currentKey = `${currentFrame.side}-${currentFrame.frameIndex}`
  const isCurrentReviewed = decisions[currentKey] != null
  const currentDecision = decisions[currentKey]
  const reviewedCount = Object.keys(decisions).length

  return (
    <div className="fixed inset-0 z-[100] bg-void flex flex-col animate-fade-in">

      {/* ============ Header ============ */}
      <div className="h-14 px-6 flex items-center justify-between bg-terminal border-b border-surface-border shrink-0">
        <div className="flex items-center gap-4">
          {/* Queue indicator — only show for multi-cavity panels */}
          {queueTotal > 1 && (
            <span className="font-display font-bold text-phosphor-teal text-lg">
              PCB {queuePosition}/{queueTotal}
            </span>
          )}
          {/* AI decision */}
          <span className="px-2 py-0.5 rounded bg-phosphor-red/20 text-phosphor-red font-mono text-sm font-bold">
            {t('cavityReview.aiNG')}
          </span>
          {/* Per-frame progress */}
          <span className="px-2 py-0.5 rounded bg-phosphor-teal/20 text-phosphor-teal font-mono text-sm font-bold">
            {t('cavityReview.ngFrame')} {reviewIndex + 1}/{totalNGFrames}
          </span>
          {/* Side indicator */}
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono text-sm">
            {currentFrame.side}
          </span>
          {/* Reviewed progress */}
          {reviewedCount > 0 && (
            <span className="font-mono text-xs text-text-tertiary">
              ({reviewedCount}/{totalNGFrames} {t('cavityReview.reviewed')})
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-NG countdown */}
          {autoNgEnabled && !showReasonInput && !isCurrentReviewed && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded font-mono text-sm",
              countdown <= 5 ? "bg-phosphor-red/20 text-phosphor-red" : "bg-phosphor-teal/20 text-phosphor-teal"
            )}>
              <Timer className="w-4 h-4" />
              {t('cavityReview.autoNG')}: {countdown}s
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1 rounded bg-elevated border border-surface-border hover:border-phosphor-teal/50 transition-colors">
              <ZoomOut className="w-4 h-4 text-text-tertiary" />
            </button>
            <span className="text-xs text-text-tertiary font-mono min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="p-1 rounded bg-elevated border border-surface-border hover:border-phosphor-teal/50 transition-colors">
              <ZoomIn className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>

          {/* Close button */}
          {onClose && (
            <button onClick={onClose}
              className="p-2 rounded bg-elevated border border-surface-border hover:border-phosphor-teal/50 transition-colors">
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          )}
        </div>
      </div>

      {/* ============ Main content: single NG frame image with arrows ============ */}
      <div className="flex-1 relative bg-void overflow-hidden min-h-0 flex items-center">
        {/* Prev Arrow */}
        {totalNGFrames > 1 && (
          <button
            onClick={() => { setReviewIndex(prev => Math.max(0, prev - 1)); setZoom(1) }}
            disabled={reviewIndex === 0}
            className={cn(
              "absolute left-3 z-10 p-3 rounded-full border-2 transition-all",
              reviewIndex === 0
                ? "border-surface-border bg-void/50 text-text-tertiary cursor-not-allowed opacity-30"
                : "border-phosphor-teal/60 bg-void/80 text-phosphor-teal hover:bg-phosphor-teal/20 hover:border-phosphor-teal"
            )}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image */}
        <div className="flex-1 h-full relative">
          {(currentFrame.image_url || currentFrame.image_raw_url) ? (
            <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4"
              style={{ cursor: zoom > 1 ? 'grab' : 'default' }}>
              <div className="relative transition-transform duration-200"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
                {/* Floating SN badge — 3 conditions */}
                {(() => {
                  const sn = currentFrame?.serial_number || boardSerialNumber
                  const snType = classifySerialNumber(sn)
                  if (snType === SN_TYPE.EMPTY) return null
                  const isTimestamp = snType === SN_TYPE.TIMESTAMP
                  const display = formatSerialDisplay(sn)
                  return (
                    <div className={cn(
                      "absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded bg-void/85 backdrop-blur-sm",
                      isTimestamp ? "border border-yellow-500/60" : "border border-phosphor-teal/50"
                    )}>
                      <span className={cn(
                        "font-mono text-sm font-bold",
                        isTimestamp ? "text-yellow-400" : "text-phosphor-teal"
                      )}>
                        {isTimestamp ? `NO READ ${display}` : `SN: ${display}`}
                      </span>
                    </div>
                  )
                })()}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentFrame.image_url || currentFrame.image_raw_url} alt={`${currentFrame.side} frame ${currentFrame.frameIndex + 1}`}
                  className="max-w-full max-h-[60vh] object-contain" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-tertiary">
              <p className="font-mono text-sm">{t('inspection.noImageAvailable')}</p>
            </div>
          )}
        </div>

        {/* Next Arrow */}
        {totalNGFrames > 1 && (
          <button
            onClick={() => { setReviewIndex(prev => Math.min(ngFrames.length - 1, prev + 1)); setZoom(1) }}
            disabled={reviewIndex === totalNGFrames - 1}
            className={cn(
              "absolute right-3 z-10 p-3 rounded-full border-2 transition-all",
              reviewIndex === totalNGFrames - 1
                ? "border-surface-border bg-void/50 text-text-tertiary cursor-not-allowed opacity-30"
                : "border-phosphor-teal/60 bg-void/80 text-phosphor-teal hover:bg-phosphor-teal/20 hover:border-phosphor-teal"
            )}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ============ NG Frame thumbnail strip ============ */}
      {totalNGFrames > 1 && (
        <div className="px-4 py-2 bg-terminal border-t border-surface-border shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 justify-center">
            {ngFrames.map((frame, idx) => {
              const key = `${frame.side}-${frame.frameIndex}`
              const isActive = idx === reviewIndex
              const isReviewed = decisions[key] != null
              const wasNG = decisions[key] === 'REAL_NG'

              return (
                <button key={key}
                  onClick={() => { setReviewIndex(idx); setZoom(1) }}
                  className={cn(
                    "relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-all",
                    isActive ? "border-phosphor-teal ring-2 ring-phosphor-teal/30"
                      : isReviewed ? (wasNG ? "border-phosphor-red/80" : "border-phosphor-green/80")
                      : "border-surface-border"
                  )}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.image_url || frame.image_raw_url} alt={`NG Frame ${idx + 1}`} className="w-full h-full object-cover" />
                  {/* Side label */}
                  <div className="absolute top-0.5 left-0.5 bg-void/80 text-text-primary text-xxs font-mono px-1 rounded">
                    {frame.side}
                  </div>
                  {/* NG badge: red by default (AI=NG), green only if user marked false call */}
                  <div className={cn(
                    "absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                    isReviewed && !wasNG ? "bg-phosphor-green" : "bg-phosphor-red"
                  )}>
                    {isReviewed
                      ? (wasNG
                        ? <AlertCircle className="w-3 h-3 text-white" />
                        : <CheckCircle2 className="w-3 h-3 text-white" />)
                      : <AlertCircle className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ Footer: Action buttons ============ */}
      <div className="h-24 px-6 flex items-center justify-center gap-8 bg-terminal border-t border-surface-border shrink-0">
        {showReasonInput ? (
          /* False call reason input */
          <div className="flex items-center gap-4 w-full max-w-2xl">
            {selectedReason === 'other' ? (
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => { setSelectedReason(''); setOtherText('') }}
                  className="h-14 px-3 bg-elevated border border-surface-border rounded-lg text-text-secondary font-mono hover:border-phosphor-teal/50 transition-colors flex-shrink-0"
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
                  className="flex-1 h-14 px-4 bg-elevated border border-surface-border rounded-lg text-text-primary font-mono placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-phosphor-green"
                />
              </div>
            ) : (
              <select
                value={selectedReason}
                onChange={(e) => { setSelectedReason(e.target.value); setOtherText('') }}
                autoFocus
                className="flex-1 h-14 px-4 bg-elevated border border-surface-border rounded-lg text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-phosphor-green"
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
              className="h-14 px-8 bg-phosphor-green text-void font-display font-bold text-lg rounded-lg hover:bg-phosphor-green-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {t('falseCall.submit')}
            </button>
            <button onClick={handleCancelReason}
              className="h-14 px-6 bg-elevated border border-surface-border text-text-secondary font-display font-bold rounded-lg hover:border-phosphor-teal/50 transition-colors">
              {t('falseCall.cancel')}
            </button>
          </div>
        ) : isCurrentReviewed ? (
          /* Already reviewed frame — show decision and navigation */
          <div className="flex items-center gap-4">
            <span className={cn(
              "font-mono text-sm px-3 py-1 rounded",
              currentDecision === 'REAL_NG' ? "bg-phosphor-red/20 text-phosphor-red" : "bg-phosphor-green/20 text-phosphor-green"
            )}>
              {currentDecision === 'REAL_NG' ? t('cavityReview.confirmedNG') : `${t('cavityReview.falseCallPrefix')}: ${currentDecision}`}
            </span>
            {reviewIndex < totalNGFrames - 1 && (
              <button onClick={() => { setReviewIndex(reviewIndex + 1); setZoom(1) }}
                className="h-14 px-8 bg-phosphor-teal text-void font-display font-bold text-lg rounded-lg hover:bg-phosphor-teal-bright transition-colors">
                {t('cavityReview.nextFrame')}
              </button>
            )}
            {reviewedCount === totalNGFrames && (
              <span className="font-mono text-sm text-phosphor-cyan animate-pulse">
                {t('cavityReview.allReviewed')}
              </span>
            )}
          </div>
        ) : (
          /* Main action buttons for current NG frame */
          <>
            <button onClick={handleFrameGood}
              className="h-16 px-12 bg-phosphor-green/10 border-2 border-phosphor-green text-phosphor-green font-display font-bold text-xl rounded-lg hover:bg-phosphor-green/20 shadow-glow-green transition-all active:scale-95 flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7" />
              {t('cavityReview.good')}
              <span className="text-sm font-mono opacity-60">(G)</span>
            </button>
            <button onClick={() => handleFrameNGRef.current?.()}
              className="h-16 px-12 bg-phosphor-red/10 border-2 border-phosphor-red text-phosphor-red font-display font-bold text-xl rounded-lg hover:bg-phosphor-red/20 shadow-glow-red transition-all active:scale-95 flex items-center gap-3">
              <AlertCircle className="w-7 h-7" />
              {t('cavityReview.ng')}
              <span className="text-sm font-mono opacity-60">(N)</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default CavityReviewOverlay

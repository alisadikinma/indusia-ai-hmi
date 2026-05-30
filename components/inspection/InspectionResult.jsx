'use client'

/**
 * InspectionResult Component
 * Displays both TOP and BOTTOM side images with defects after inspection complete
 * Supports multiple frames per side (carousel)
 * Shows AI Result in the center divider
 */

import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { isRealPcb } from '@/lib/utils/serialNumber'
import SidePanel from './SidePanel'

export function InspectionResult({ inspection, className, onFrameClick, reviewingFrameKey, frameDecisions, modelName }) {
  if (!inspection) return null

  const { results, decision } = inspection

  // results.top and results.bottom are now arrays of frames
  // Handle both array format (new) and object format (legacy)
  const topFrames = Array.isArray(results?.top) ? results.top : 
                    results?.top?.image_url ? [results.top] : []
  const bottomFrames = Array.isArray(results?.bottom) ? results.bottom : 
                       results?.bottom?.image_url ? [results.bottom] : []

  // Determine AI result for display.
  // Override FAIL → GOOD when all NG frames are on empty cavities (SN="0").
  const aiResult = (() => {
    if (decision === 'PASS') return 'GOOD'
    if (decision !== 'FAIL') return 'WAITING'
    const allFrames = [...topFrames, ...bottomFrames]
    const hasSN = allFrames.some(f => f.serial_number != null)
    if (hasSN && !allFrames.some(f => f.label == true && isRealPcb(f.serial_number))) {
      return 'GOOD'
    }
    return 'NG'
  })()

  const hasTop = topFrames.length > 0
  const hasBottom = bottomFrames.length > 0
  const hasBothSides = hasTop && hasBottom
  const hasSingleSide = (hasTop || hasBottom) && !hasBothSides

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Dual Side Images with AI Result Center */}
      <div className={cn(
        "flex-1 p-3 gap-3 min-h-0 overflow-hidden",
        hasBothSides ? "flex" : "flex justify-center"
      )}>
        {/* TOP Side */}
        {hasTop && (
          <SidePanel
            side="TOP"
            frames={topFrames}
            onFrameClick={onFrameClick}
            reviewingFrameKey={reviewingFrameKey}
            frameDecisions={frameDecisions}
            modelName={modelName}
            className={cn(
              hasSingleSide ? "max-w-3xl w-full" : "flex-1"
            )}
          />
        )}

        {/* AI Result Center Divider - only show when both sides */}
        {hasBothSides && (
          <div className="flex flex-col items-center justify-center px-2">
            {/* Vertical Line Top */}
            <div className="flex-1 w-px bg-surface-border" />
            
            {/* AI Result Badge */}
            <div className={cn(
              "flex flex-col items-center gap-2 py-4 px-3 border-2 my-2",
              aiResult === 'NG' && "bg-phosphor-red/10 border-phosphor-red",
              aiResult === 'GOOD' && "bg-phosphor-green/10 border-phosphor-green",
              aiResult === 'WAITING' && "bg-terminal border-surface-border"
            )}>
              {aiResult === 'NG' && <AlertTriangle className="w-8 h-8 text-phosphor-red" />}
              {aiResult === 'GOOD' && <CheckCircle2 className="w-8 h-8 text-phosphor-green" />}
              {aiResult === 'WAITING' && <Clock className="w-8 h-8 text-text-tertiary" />}
              
              <div className="text-center">
                <p className="font-mono text-xxs text-text-tertiary">AI RESULT</p>
                <p className={cn(
                  "font-display text-lg font-bold tracking-wider",
                  aiResult === 'NG' && "text-phosphor-red",
                  aiResult === 'GOOD' && "text-phosphor-green",
                  aiResult === 'WAITING' && "text-text-tertiary"
                )}>
                  {aiResult}
                </p>
              </div>
            </div>
            
            {/* Vertical Line Bottom */}
            <div className="flex-1 w-px bg-surface-border" />
          </div>
        )}

        {/* BOTTOM Side */}
        {hasBottom && (
          <SidePanel
            side="BOTTOM"
            frames={bottomFrames}
            onFrameClick={onFrameClick}
            reviewingFrameKey={reviewingFrameKey}
            frameDecisions={frameDecisions}
            modelName={modelName}
            className={cn(
              hasSingleSide ? "max-w-3xl w-full" : "flex-1"
            )}
          />
        )}

        {/* No images available */}
        {!hasTop && !hasBottom && (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p className="font-mono text-sm">No inspection images available</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InspectionResult

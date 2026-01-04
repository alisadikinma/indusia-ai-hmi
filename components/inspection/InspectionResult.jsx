'use client'

/**
 * InspectionResult Component
 * Displays both TOP and BOTTOM side images with defects after inspection complete
 * Supports multiple frames per side (carousel)
 */

import { cn } from '@/lib/utils'
import SidePanel from './SidePanel'

export function InspectionResult({ inspection, className }) {
  if (!inspection) return null

  const { results } = inspection

  // results.top and results.bottom are now arrays of frames
  // Handle both array format (new) and object format (legacy)
  const topFrames = Array.isArray(results?.top) ? results.top : 
                    results?.top?.image_url ? [results.top] : []
  const bottomFrames = Array.isArray(results?.bottom) ? results.bottom : 
                       results?.bottom?.image_url ? [results.bottom] : []

  const hasTop = topFrames.length > 0
  const hasBottom = bottomFrames.length > 0
  const hasBothSides = hasTop && hasBottom
  const hasSingleSide = (hasTop || hasBottom) && !hasBothSides

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Dual Side Images */}
      <div className={cn(
        "flex-1 p-3 gap-3 min-h-0",
        hasBothSides ? "grid grid-cols-2" : "flex justify-center"
      )}>
        {/* TOP Side */}
        {hasTop && (
          <SidePanel
            side="TOP"
            frames={topFrames}
            className={hasSingleSide ? "max-w-3xl w-full" : ""}
          />
        )}

        {/* BOTTOM Side */}
        {hasBottom && (
          <SidePanel
            side="BOTTOM"
            frames={bottomFrames}
            className={hasSingleSide ? "max-w-3xl w-full" : ""}
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

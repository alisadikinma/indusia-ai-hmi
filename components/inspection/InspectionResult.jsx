'use client'

/**
 * InspectionResult Component
 * Displays both TOP and BOTTOM side images with defects after inspection complete
 */

import { cn } from '@/lib/utils'
import SidePanel from './SidePanel'

export function InspectionResult({ inspection, className }) {
  if (!inspection) return null

  const { results } = inspection

  // Check what sides we have
  const hasTop = !!results?.top?.image_url
  const hasBottom = !!results?.bottom?.image_url
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
            imageUrl={results.top.image_url}
            objects={results.top.objects || []}
            className={hasSingleSide ? "max-w-3xl w-full" : ""}
          />
        )}

        {/* BOTTOM Side */}
        {hasBottom && (
          <SidePanel
            side="BOTTOM"
            imageUrl={results.bottom.image_url}
            objects={results.bottom.objects || []}
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

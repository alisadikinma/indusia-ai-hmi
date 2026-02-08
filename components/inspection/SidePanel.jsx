'use client'

/**
 * SidePanel Component V2
 * Displays a single side (TOP/BOTTOM) with carousel for multiple frames
 * 
 * Features:
 * - Thumbnail strip carousel
 * - Frame indicator "Frame 1/3"
 * - Defect badge per frame
 * - Bounding box overlay per frame
 */

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ZoomIn, ZoomOut, Maximize2, AlertCircle, CheckCircle2 } from 'lucide-react'

// Defect type color mapping
const DEFECT_COLORS = {
  'solder_bridge': '#EF4444',
  'cold_solder': '#F59E0B',
  'missing_component': '#8B5CF6',
  'tombstone': '#EC4899',
  'solder_ball': '#06B6D4',
  'insufficient_solder': '#F97316',
  'excess_solder': '#EAB308',
  'lifted_lead': '#A855F7',
  'target-d': '#10B981',
  'target-u': '#EF4444',
  'target-x': '#F59E0B',
  'default': '#EF4444'
}

export function SidePanel({ side, frames = [], className }) {
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [imageSize, setImageSize] = useState({ natural: { w: 0, h: 0 }, rendered: { w: 0, h: 0 } })
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  
  // Current active frame
  const activeFrame = frames[activeFrameIndex] || null
  const imageUrl = activeFrame?.image_url
  const objects = activeFrame?.objects || []
  
  // Use frame-level label (true=NG, false=GOOD) as the authoritative AI verdict.
  // Object-level obj.label is unreliable — some backends set label=1 for ALL
  // detected objects (components + defects), inflating the count.
  // Use loose equality (== true) because backend may send label as boolean true OR integer 1
  const ngFrameCount = frames.filter(f => f.label == true).length
  const hasDefects = ngFrameCount > 0
  const frameCount = frames.length

  // Reset active frame when frames change
  useEffect(() => {
    setActiveFrameIndex(0)
  }, [frames])

  // Track image load and resize
  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const updateSize = () => {
      if (img.naturalWidth && img.clientWidth) {
        setImageSize({
          natural: { w: img.naturalWidth, h: img.naturalHeight },
          rendered: { w: img.clientWidth, h: img.clientHeight }
        })
      }
    }

    img.addEventListener('load', updateSize)
    window.addEventListener('resize', updateSize)
    
    if (img.complete) updateSize()

    return () => {
      img.removeEventListener('load', updateSize)
      window.removeEventListener('resize', updateSize)
    }
  }, [imageUrl])

  const getDefectColor = (name) => {
    const key = name?.toLowerCase().replace(/\s+/g, '_')
    return DEFECT_COLORS[key] || DEFECT_COLORS.default
  }

  // Note: BBOX overlay removed - AI Backend renders bbox on images
  // Scale factors kept for potential future use

  // No frames available
  if (frameCount === 0) {
    return (
      <div className={cn(
        "bg-panel rounded-lg overflow-hidden flex flex-col border border-surface-border",
        className
      )}>
        <div className="px-4 py-3 bg-terminal">
          <span className="font-display font-bold text-lg text-text-primary">{side} Side</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-tertiary min-h-[250px]">
          <p className="font-mono text-sm">No image available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "bg-panel rounded-lg overflow-hidden flex flex-col border",
      hasDefects ? "border-phosphor-red/50" : "border-phosphor-green/50",
      className
    )}>
      {/* Side Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        hasDefects ? "bg-phosphor-red/10" : "bg-phosphor-green/10"
      )}>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-lg text-text-primary">{side} Side</span>
          <span className={cn(
            "text-sm font-mono font-medium px-2 py-0.5 rounded",
            hasDefects
              ? "bg-phosphor-red/20 text-phosphor-red"
              : "bg-phosphor-green/20 text-phosphor-green"
          )}>
            {hasDefects ? `${ngFrameCount} NG` : 'PASS'}
          </span>
          
          {/* Frame Indicator */}
          {frameCount > 1 && (
            <span className="text-xs font-mono text-text-tertiary bg-terminal px-2 py-1 rounded">
              Frame {activeFrameIndex + 1}/{frameCount}
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded bg-terminal border border-surface-border hover:border-phosphor-amber/50 transition-colors"
          >
            <ZoomOut className="w-4 h-4 text-text-tertiary" />
          </button>
          <span className="text-xs text-text-tertiary font-mono min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="p-1.5 rounded bg-terminal border border-surface-border hover:border-phosphor-amber/50 transition-colors"
          >
            <ZoomIn className="w-4 h-4 text-text-tertiary" />
          </button>
          <button
            onClick={() => setShowFullscreen(true)}
            className="p-1.5 rounded bg-terminal border border-surface-border hover:border-phosphor-amber/50 transition-colors ml-2"
          >
            <Maximize2 className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-void overflow-hidden min-h-[250px]"
      >
        {imageUrl ? (
          <div
            className="absolute inset-0 flex items-center justify-center overflow-auto p-2"
            style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
          >
            <div
              className="relative transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              {/* Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt={`${side} side inspection frame ${activeFrameIndex + 1}`}
                className="max-w-full max-h-[300px] object-contain"
              />

              {/* BBOX overlay removed - AI Backend already renders bbox on images */}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p className="font-mono text-sm">No image available</p>
          </div>
        )}
      </div>

      {/* Thumbnail Carousel Strip */}
      {frameCount > 1 && (
        <div className="px-3 py-2 bg-terminal border-t border-surface-border">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {frames.map((frame, index) => {
              const frameIsNG = frame.label == true
              const isActive = index === activeFrameIndex

              return (
                <button
                  key={index}
                  onClick={() => setActiveFrameIndex(index)}
                  className={cn(
                    "relative flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all",
                    isActive
                      ? "border-phosphor-amber ring-2 ring-phosphor-amber/30"
                      : frameIsNG
                        ? "border-phosphor-red/50 hover:border-phosphor-red"
                        : "border-surface-border hover:border-phosphor-green/50"
                  )}
                >
                  {/* Thumbnail Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.image_url}
                    alt={`Frame ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* NG/GOOD Badge (based on frame.label) */}
                  <div className={cn(
                    "absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                    frameIsNG ? "bg-phosphor-red" : "bg-phosphor-green"
                  )}>
                    {frameIsNG ? (
                      <AlertCircle className="w-3 h-3 text-white" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-void/95 flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-3 bg-panel border border-surface-border rounded hover:border-phosphor-amber transition-colors"
            onClick={() => setShowFullscreen(false)}
          >
            <span className="text-text-primary text-xl font-bold">&times;</span>
          </button>
          <div className="text-center">
            <p className="text-phosphor-amber font-display font-bold text-lg mb-2">{side} Side</p>
            {frameCount > 1 && (
              <p className="text-text-tertiary font-mono text-sm mb-4">Frame {activeFrameIndex + 1}/{frameCount}</p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${side} side fullscreen`}
              className="max-w-[90vw] max-h-[80vh] object-contain border border-surface-border"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SidePanel

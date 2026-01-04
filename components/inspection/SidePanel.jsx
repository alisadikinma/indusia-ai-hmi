'use client'

/**
 * SidePanel Component
 * Displays a single side (TOP/BOTTOM) with image, bounding boxes, and defect list
 */

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

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
  'default': '#EF4444'
}

export function SidePanel({ side, imageUrl, objects = [], className }) {
  const [zoom, setZoom] = useState(1)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [imageSize, setImageSize] = useState({ natural: { w: 0, h: 0 }, rendered: { w: 0, h: 0 } })
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  
  const hasDefects = objects.length > 0

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
    
    // Initial check
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

  // Calculate scale factor for bounding boxes
  const scaleX = imageSize.rendered.w / (imageSize.natural.w || 1)
  const scaleY = imageSize.rendered.h / (imageSize.natural.h || 1)

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
            {hasDefects ? `${objects.length} defect(s)` : 'PASS'}
          </span>
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
                alt={`${side} side inspection`}
                className="max-w-full max-h-[350px] object-contain"
              />

              {/* Bounding Boxes Overlay - positioned absolutely over image */}
              {imageSize.rendered.w > 0 && objects.length > 0 && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none"
                  width={imageSize.rendered.w}
                  height={imageSize.rendered.h}
                  viewBox={`0 0 ${imageSize.rendered.w} ${imageSize.rendered.h}`}
                  style={{ overflow: 'visible' }}
                >
                  {objects.map((obj, i) => {
                    const [x1, y1, x2, y2] = obj.box || [0, 0, 0, 0]
                    const color = getDefectColor(obj.name)
                    
                    // Scale coordinates to rendered size
                    const sx1 = x1 * scaleX
                    const sy1 = y1 * scaleY
                    const sx2 = x2 * scaleX
                    const sy2 = y2 * scaleY
                    const boxWidth = sx2 - sx1
                    const boxHeight = sy2 - sy1
                    
                    const labelWidth = Math.max(60, (obj.name?.length || 5) * 6 + 35)
                    
                    return (
                      <g key={i}>
                        {/* Bounding Box */}
                        <rect
                          x={sx1}
                          y={sy1}
                          width={boxWidth}
                          height={boxHeight}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                        {/* Corner markers */}
                        <line x1={sx1} y1={sy1} x2={sx1 + 10} y2={sy1} stroke={color} strokeWidth={3} />
                        <line x1={sx1} y1={sy1} x2={sx1} y2={sy1 + 10} stroke={color} strokeWidth={3} />
                        <line x1={sx2} y1={sy1} x2={sx2 - 10} y2={sy1} stroke={color} strokeWidth={3} />
                        <line x1={sx2} y1={sy1} x2={sx2} y2={sy1 + 10} stroke={color} strokeWidth={3} />
                        <line x1={sx1} y1={sy2} x2={sx1 + 10} y2={sy2} stroke={color} strokeWidth={3} />
                        <line x1={sx1} y1={sy2} x2={sx1} y2={sy2 - 10} stroke={color} strokeWidth={3} />
                        <line x1={sx2} y1={sy2} x2={sx2 - 10} y2={sy2} stroke={color} strokeWidth={3} />
                        <line x1={sx2} y1={sy2} x2={sx2} y2={sy2 - 10} stroke={color} strokeWidth={3} />
                        
                        {/* Label Background */}
                        <rect
                          x={sx1}
                          y={sy1 - 20}
                          width={labelWidth}
                          height={18}
                          fill={color}
                          rx={2}
                        />
                        {/* Label Text */}
                        <text
                          x={sx1 + 4}
                          y={sy1 - 6}
                          fill="white"
                          fontSize={11}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {obj.name} {Math.round(obj.score * 100)}%
                        </text>
                      </g>
                    )
                  })}
                </svg>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p className="font-mono text-sm">No image available</p>
          </div>
        )}
      </div>

      {/* Defect List */}
      {hasDefects && (
        <div className="p-3 border-t border-surface-border bg-terminal max-h-28 overflow-y-auto">
          <div className="text-xs font-mono text-text-tertiary mb-2">
            Detected Defects:
          </div>
          <div className="space-y-1">
            {objects.map((obj, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-panel border border-surface-border"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getDefectColor(obj.name) }}
                  />
                  <span className="text-text-primary font-mono">{obj.name}</span>
                </div>
                <span className={cn(
                  "text-xs font-mono px-2 py-0.5 rounded",
                  obj.score >= 0.85 ? "bg-phosphor-red/20 text-phosphor-red" :
                  obj.score >= 0.70 ? "bg-phosphor-amber/20 text-phosphor-amber" :
                  "bg-phosphor-cyan/20 text-phosphor-cyan"
                )}>
                  {(obj.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
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
            <p className="text-phosphor-amber font-display font-bold text-lg mb-4">{side} Side</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${side} side fullscreen`}
              className="max-w-[90vw] max-h-[85vh] object-contain border border-surface-border"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SidePanel

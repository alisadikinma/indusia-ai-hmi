'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.5  // relative to fit scale
const MAX_ZOOM = 12
const ZOOM_STEP = 0.3
const ZOOM_TO_BBOX_MIN = 3 // minimum zoom when jumping to bbox

/**
 * ImageViewer — Zoomable, pannable image with bounding box overlays.
 *
 * The image always fits the container initially (scale = fitScale).
 * Zoom level is relative: 1x = fit-to-container, 2x = 2× that size, etc.
 * Bbox coordinates are in original image pixels (natural size).
 *
 * Props:
 * - src: image URL
 * - alt: alt text
 * - objects: [{ name, box: [x1,y1,x2,y2], score, label }]
 * - activeObjectIndex: highlight and auto-zoom to this object (-1 = none)
 * - onObjectClick: (index) => void
 * - imageNaturalSize: { width, height } if known
 * - className: wrapper class
 * - showControls: show zoom controls (default true)
 * - overlayColor: bbox stroke color
 * - activeColor: active bbox color
 */
export default function ImageViewer({
  src,
  alt = 'Image',
  objects = [],
  activeObjectIndex = -1,
  onObjectClick,
  imageNaturalSize,
  className,
  showControls = true,
  overlayColor = 'rgba(255,68,68,0.8)',
  activeColor = 'rgba(9,168,164,1)',
  goodColor = 'rgba(0,255,102,0.7)',
}) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [zoom, setZoom] = useState(1) // 1 = fit-to-container
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState(imageNaturalSize || null)
  const [fitScale, setFitScale] = useState(1) // scale factor: fitScale * zoom = actual CSS scale

  // Calculate fit scale: how much to shrink the natural image to fit container
  const calcFitScale = useCallback(() => {
    if (!containerRef.current || !naturalSize) return 1
    const rect = containerRef.current.getBoundingClientRect()
    const sx = rect.width / naturalSize.width
    const sy = rect.height / naturalSize.height
    return Math.min(sx, sy, 1) // never upscale beyond 1:1
  }, [naturalSize])

  // Reset when image changes
  useEffect(() => {
    setZoom(1)
    setTranslate({ x: 0, y: 0 })
    setImgLoaded(false)
    setNaturalSize(imageNaturalSize || null)
  }, [src, imageNaturalSize])

  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target
    setNaturalSize({ width: naturalWidth, height: naturalHeight })
    setImgLoaded(true)
  }, [])

  // Recalculate fit scale when natural size or container changes
  useEffect(() => {
    if (!naturalSize || !imgLoaded) return
    const fs = calcFitScale()
    setFitScale(fs)
  }, [naturalSize, imgLoaded, calcFitScale, isFullscreen])

  // ResizeObserver: recalculate fitScale + centering when container resizes
  useEffect(() => {
    if (!containerRef.current || !naturalSize || !imgLoaded) return
    const observer = new ResizeObserver(() => {
      const fs = calcFitScale()
      setFitScale(fs)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [naturalSize, imgLoaded, calcFitScale])

  // Center image when fit-to-container at zoom=1
  useEffect(() => {
    if (!imgLoaded || !containerRef.current || !naturalSize) return
    if (zoom === 1 && activeObjectIndex < 0) {
      // Center the fitted image
      const rect = containerRef.current.getBoundingClientRect()
      const fs = calcFitScale()
      const imgW = naturalSize.width * fs
      const imgH = naturalSize.height * fs
      setTranslate({
        x: (rect.width - imgW) / 2,
        y: (rect.height - imgH) / 2,
      })
    }
  }, [imgLoaded, fitScale, zoom, activeObjectIndex, naturalSize, calcFitScale])

  // The actual CSS scale applied to the image wrapper
  const actualScale = fitScale * zoom

  // Zoom to object bbox
  useEffect(() => {
    if (activeObjectIndex < 0 || !objects[activeObjectIndex] || !containerRef.current || !naturalSize) return

    const obj = objects[activeObjectIndex]
    const [x1, y1, x2, y2] = obj.box
    const centerX = (x1 + x2) / 2
    const centerY = (y1 + y2) / 2
    const bboxW = x2 - x1
    const bboxH = y2 - y1

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()

    // Determine zoom level to fit bbox nicely
    const padding = 100 // pixels of padding around bbox in container
    const fitZoomX = containerRect.width / ((bboxW * fitScale) + padding)
    const fitZoomY = containerRect.height / ((bboxH * fitScale) + padding)
    const targetZoom = Math.min(Math.max(Math.min(fitZoomX, fitZoomY), ZOOM_TO_BBOX_MIN), MAX_ZOOM)

    const targetScale = fitScale * targetZoom

    // Translate so bbox center aligns with container center
    const displayCenterX = centerX * targetScale
    const displayCenterY = centerY * targetScale
    const newX = containerRect.width / 2 - displayCenterX
    const newY = containerRect.height / 2 - displayCenterY

    setZoom(targetZoom)
    setTranslate({ x: newX, y: newY })
  }, [activeObjectIndex, objects, naturalSize, imgLoaded, fitScale])

  // Zoom controls (relative zoom)
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    // translate will be reset by the centering effect
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom(prev => Math.min(Math.max(prev + delta * prev, MIN_ZOOM), MAX_ZOOM))
  }, [])

  // Pan drag handlers
  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
  }, [zoom, translate])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    setTranslate({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Compute bbox overlay positions (relative to natural image, scaled by actualScale)
  const renderBboxes = () => {
    if (!naturalSize || objects.length === 0) return null

    return objects.map((obj, i) => {
      if (!obj.box || obj.box.length < 4) return null
      const [x1, y1, x2, y2] = obj.box
      const isActive = i === activeObjectIndex
      // Color by label: label=0/false → GOOD (green), label=1/true → NG (red)
      const isGoodLabel = obj.label === 0 || obj.label === false
      const defaultColor = isGoodLabel ? goodColor : overlayColor
      const color = isActive ? activeColor : defaultColor

      return (
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            onObjectClick?.(i)
          }}
          className={cn(
            'absolute border-2 cursor-pointer transition-all duration-200',
            isActive ? 'z-10 shadow-lg' : 'z-0 hover:z-10',
            onObjectClick && 'hover:border-phosphor-teal'
          )}
          style={{
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1,
            borderColor: color,
            backgroundColor: isActive ? `${activeColor.replace('1)', '0.12)')}` : 'transparent',
          }}
          title={`${obj.name}${obj.score != null ? ` (${(obj.score * 100).toFixed(1)}%)` : ''}`}
        >
          {/* Label */}
          <div
            className="absolute left-0 px-1 py-0 font-mono leading-tight whitespace-nowrap rounded-t"
            style={{
              bottom: '100%',
              fontSize: Math.max(10, 14 / zoom),
              backgroundColor: color,
              color: '#fff',
            }}
          >
            {obj.name}{obj.score != null ? ` ${(obj.score * 100).toFixed(0)}%` : ''}
          </div>
        </div>
      )
    })
  }

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-black flex items-center justify-center'
    : cn('relative overflow-hidden rounded-lg bg-black/90', className)

  // Percentage for display (100% = fit to container)
  const displayPercent = Math.round(zoom * 100)

  return (
    <div
      ref={containerRef}
      className={wrapperClass}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
    >
      {/* Image + bbox overlay — both scaled together */}
      <div
        className="absolute origin-top-left"
        style={{
          width: naturalSize ? naturalSize.width : 'auto',
          height: naturalSize ? naturalSize.height : 'auto',
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${actualScale})`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          className="select-none"
          draggable={false}
          style={{
            width: naturalSize ? naturalSize.width : 'auto',
            height: naturalSize ? naturalSize.height : 'auto',
          }}
        />
        {/* Bounding box overlays — positioned in natural image coordinates */}
        {imgLoaded && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ width: naturalSize?.width, height: naturalSize?.height }}
          >
            <div className="relative w-full h-full pointer-events-auto">
              {renderBboxes()}
            </div>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      {showControls && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/70 rounded-lg px-1 py-1 z-20">
          <button
            onClick={zoomIn}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/50 font-mono px-1 min-w-[3ch] text-center">
            {displayPercent}%
          </span>
          <button
            onClick={resetView}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title="Fit to view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Fullscreen close hint */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-20 p-2 bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

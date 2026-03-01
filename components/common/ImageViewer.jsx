'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeBox, computeBboxScale } from '@/lib/utils/inspectionReview'

const MIN_ZOOM = 0.5  // relative to fit scale
const MAX_ZOOM = 5
const ZOOM_STEP = 0.3
const ZOOM_TO_BBOX_MIN = 1.5 // minimum zoom when jumping to bbox

/**
 * ImageViewer — Zoomable, pannable image with auto-zoom-to-coordinate navigation.
 *
 * The image always fits the container initially (scale = fitScale).
 * Zoom level is relative: 1x = fit-to-container, 2x = 2× that size, etc.
 *
 * Bbox overlays are NOT rendered — AI backend draws bboxes on raw images.
 * The objects prop is still used for auto-zoom coordinate math.
 *
 * Props:
 * - src: image URL
 * - alt: alt text
 * - objects: [{ box: [x1,y1,x2,y2] }] — used for auto-zoom math only, not rendered
 * - activeObjectIndex: auto-zoom to this object's coordinates (-1 = none)
 * - focusTrigger: increment to re-trigger zoom (for re-clicking same object)
 * - imageNaturalSize: { width, height } if known
 * - className: wrapper class
 * - showControls: show zoom controls (default true)
 */
export default function ImageViewer({
  src,
  alt = 'Image',
  objects = [],
  activeObjectIndex = -1,
  focusTrigger = 0,
  imageNaturalSize,
  className,
  showControls = true,
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

  // Refs for non-reactive reads in focus effect (avoids re-triggering on every render)
  const fitScaleRef = useRef(1)
  const bboxScaleRef = useRef({ x: 1, y: 1 })
  const prevFocusRef = useRef(activeObjectIndex)
  // Deferred zoom: when auto-zoom fires before image is loaded, store target here
  const pendingZoomRef = useRef(null)

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
    // Batch these — React will re-run effects with both values set
    setNaturalSize({ width: naturalWidth, height: naturalHeight })
    setImgLoaded(true)
    // Note: if pendingZoomRef has a stored zoom target, the auto-zoom effect
    // will re-run because imgLoaded + naturalSize changed, picking up the pending target
  }, [])

  // Recalculate fit scale when natural size or container changes
  // Use requestAnimationFrame to ensure DOM has updated after fullscreen toggle
  useEffect(() => {
    if (!naturalSize || !imgLoaded) return
    const raf = requestAnimationFrame(() => {
      const fs = calcFitScale()
      setFitScale(fs)
    })
    return () => cancelAnimationFrame(raf)
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
  // Centers regardless of activeObjectIndex since auto-zoom to bbox is disabled.
  // Double-rAF ensures DOM layout is fully settled after frame/image switch.
  useEffect(() => {
    if (!imgLoaded || !containerRef.current || !naturalSize) return
    if (zoom === 1) {
      // Use double rAF to ensure DOM layout is fully settled
      // (especially after fullscreen toggle or image src change)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!containerRef.current) return
          const rect = containerRef.current.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) return
          const fs = calcFitScale()
          const imgW = naturalSize.width * fs
          const imgH = naturalSize.height * fs
          setTranslate({
            x: (rect.width - imgW) / 2,
            y: (rect.height - imgH) / 2,
          })
        })
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [imgLoaded, fitScale, zoom, naturalSize, calcFitScale, isFullscreen])

  // The actual CSS scale applied to the image wrapper
  const actualScale = fitScale * zoom

  // Detect if bbox coords are in a different resolution than the image
  const bboxScale = useMemo(
    () => computeBboxScale(naturalSize, objects),
    [naturalSize, objects]
  )

  // Keep refs in sync for non-reactive reads
  useEffect(() => { fitScaleRef.current = fitScale }, [fitScale])
  useEffect(() => { bboxScaleRef.current = bboxScale }, [bboxScale])

  // Auto-zoom to bbox: center the active object in the viewport with precise transform math.
  // Uses refs for fitScale/bboxScale to avoid re-triggering on every render.
  // Handles deferred zoom: if image isn't loaded when zoom is requested, stores
  // target in pendingZoomRef and re-executes when imgLoaded/naturalSize become available.
  useEffect(() => {
    // Deselect → reset to fit view
    if (activeObjectIndex == null || activeObjectIndex < 0) {
      pendingZoomRef.current = null
      if (prevFocusRef.current != null && prevFocusRef.current >= 0) {
        setZoom(1)
        // translate will be reset by the centering effect (zoom === 1)
      }
      prevFocusRef.current = activeObjectIndex
      return
    }
    prevFocusRef.current = activeObjectIndex

    // Guard: need loaded image, natural size, container, and valid object
    if (!imgLoaded || !naturalSize || !containerRef.current) {
      // Store pending zoom to execute after image loads
      pendingZoomRef.current = { activeObjectIndex, focusTrigger }
      return
    }

    // Clear pending zoom — we're executing now
    pendingZoomRef.current = null

    const obj = objects[activeObjectIndex]
    if (!obj || !obj.box || obj.box.length < 4) return

    const rect = containerRef.current.getBoundingClientRect()
    const containerW = rect.width
    const containerH = rect.height
    if (containerW === 0 || containerH === 0) return

    const fs = fitScaleRef.current
    const bs = bboxScaleRef.current

    // Map bbox coords to natural image pixel space (accounting for resolution mismatch)
    const [rx1, ry1, rx2, ry2] = normalizeBox(obj.box)
    const x1 = rx1 * bs.x, y1 = ry1 * bs.y
    const x2 = rx2 * bs.x, y2 = ry2 * bs.y

    // Bounds check: ensure bbox is within image dimensions
    const imgW = naturalSize.width
    const imgH = naturalSize.height
    const clampedX1 = Math.max(0, Math.min(x1, imgW))
    const clampedY1 = Math.max(0, Math.min(y1, imgH))
    const clampedX2 = Math.max(0, Math.min(x2, imgW))
    const clampedY2 = Math.max(0, Math.min(y2, imgH))

    // If bbox is effectively zero-size after clamping, skip zoom
    const bboxW = Math.max(clampedX2 - clampedX1, 1)
    const bboxH = Math.max(clampedY2 - clampedY1, 1)

    // Bbox center in natural image pixels
    const cx = (clampedX1 + clampedX2) / 2
    const cy = (clampedY1 + clampedY2) / 2

    // Compute zoom so bbox fills ~25% of container (fit the larger dimension)
    const zoomForWidth = (containerW * 0.25) / (bboxW * fs)
    const zoomForHeight = (containerH * 0.25) / (bboxH * fs)
    const targetZoom = Math.max(
      ZOOM_TO_BBOX_MIN,
      Math.min(Math.min(zoomForWidth, zoomForHeight), MAX_ZOOM)
    )

    // Compute translate so bbox center maps to container center.
    // With transform-origin: top-left, point (cx, cy) in natural coords
    // appears at screen position (tx + cx * actualScale, ty + cy * actualScale).
    // Setting that equal to (containerW/2, containerH/2):
    const newActualScale = fs * targetZoom
    let tx = containerW / 2 - cx * newActualScale
    let ty = containerH / 2 - cy * newActualScale

    // Clamp translate: ensure at least some image content is visible in viewport
    // Prevent panning so far that the entire viewport shows only black/empty area
    const scaledImgW = imgW * newActualScale
    const scaledImgH = imgH * newActualScale
    const minVisiblePx = 50 // at least 50px of image visible
    tx = Math.max(-(scaledImgW - minVisiblePx), Math.min(containerW - minVisiblePx, tx))
    ty = Math.max(-(scaledImgH - minVisiblePx), Math.min(containerH - minVisiblePx, ty))

    setZoom(targetZoom)
    setTranslate({ x: tx, y: ty })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeObjectIndex, focusTrigger, imgLoaded, naturalSize])
  // objects, fitScale, bboxScale deliberately excluded — read from refs to avoid loops

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
    // Reset view so fitScale recalculates for new container size
    setZoom(1)
    setTranslate({ x: 0, y: 0 })
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

  // Bbox rendering removed — AI backend draws bboxes on raw images.
  // objects prop + bboxScale + auto-zoom math are kept for invisible navigation.

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-black overflow-hidden'
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
        {/* Bbox overlays removed — AI backend draws bboxes on raw images */}
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

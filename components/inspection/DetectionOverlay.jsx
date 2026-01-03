'use client'

/**
 * Detection Overlay Component
 * Canvas-based overlay showing AI detections on inspection images
 * Control Room Brutalism Design
 */

import { useRef, useEffect, useState } from 'react'

export function DetectionOverlay({
  imageUrl,
  detections = [],
  result,
  width = '100%',
  height = '100%'
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef(null)

  // Colors - Phosphor theme
  const resultColors = {
    pass: '#00FF66',    // phosphor-green
    fail: '#FF4444',    // phosphor-red
    review: '#FFAA00'   // phosphor-amber
  }

  const resultLabels = {
    pass: 'PASS',
    fail: 'FAIL',
    review: 'REVIEW'
  }

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 600
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Load image
  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(false)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      setImageLoaded(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = dimensions

    // Set canvas dimensions
    canvas.width = w
    canvas.height = h

    // Clear canvas
    ctx.clearRect(0, 0, w, h)

    // Draw background - void black
    ctx.fillStyle = '#0A0E14'
    ctx.fillRect(0, 0, w, h)

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.06)'
    ctx.lineWidth = 1
    const gridSize = 20
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Draw image if loaded
    if (imageRef.current && imageLoaded) {
      // Calculate aspect ratio fit
      const imgRatio = imageRef.current.width / imageRef.current.height
      const canvasRatio = w / h
      let drawW, drawH, drawX, drawY

      if (imgRatio > canvasRatio) {
        drawW = w
        drawH = w / imgRatio
        drawX = 0
        drawY = (h - drawH) / 2
      } else {
        drawH = h
        drawW = h * imgRatio
        drawX = (w - drawW) / 2
        drawY = 0
      }

      ctx.drawImage(imageRef.current, drawX, drawY, drawW, drawH)

      // Draw detections (scale coordinates)
      const scaleX = drawW / imageRef.current.width
      const scaleY = drawH / imageRef.current.height

      detections.forEach(det => {
        if (!det.bbox || det.bbox.length !== 4) return

        const [x1, y1, x2, y2] = det.bbox
        const confidence = det.confidence || 0

        // Scale coordinates
        const sx1 = drawX + x1 * scaleX
        const sy1 = drawY + y1 * scaleY
        const sx2 = drawX + x2 * scaleX
        const sy2 = drawY + y2 * scaleY

        // Color based on severity/confidence
        let color = '#FFAA00' // default amber
        if (det.severity === 'critical' || det.class_name?.includes('bridge') || det.class_name?.includes('short')) {
          color = '#FF4444' // red
        } else if (det.severity === 'warning' || confidence >= 0.75) {
          color = '#FFAA00' // amber
        } else if (det.severity === 'info') {
          color = '#00DDFF' // cyan
        }

        // Draw box - square corners (brutalist)
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1)

        // Draw label background
        const label = `${det.class_name || det.class || 'DEFECT'} ${Math.round(confidence * 100)}%`
        ctx.font = 'bold 12px "JetBrains Mono", monospace'
        const labelWidth = ctx.measureText(label).width + 12
        ctx.fillStyle = color
        ctx.fillRect(sx1, sy1 - 20, labelWidth, 18)

        // Draw label text
        ctx.fillStyle = '#050608' // void black
        ctx.textBaseline = 'middle'
        ctx.fillText(label, sx1 + 6, sy1 - 11)

        // Draw corner indicators
        const cornerSize = 8
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        // Top-left
        ctx.beginPath()
        ctx.moveTo(sx1, sy1 + cornerSize)
        ctx.lineTo(sx1, sy1)
        ctx.lineTo(sx1 + cornerSize, sy1)
        ctx.stroke()
        // Top-right
        ctx.beginPath()
        ctx.moveTo(sx2 - cornerSize, sy1)
        ctx.lineTo(sx2, sy1)
        ctx.lineTo(sx2, sy1 + cornerSize)
        ctx.stroke()
        // Bottom-left
        ctx.beginPath()
        ctx.moveTo(sx1, sy2 - cornerSize)
        ctx.lineTo(sx1, sy2)
        ctx.lineTo(sx1 + cornerSize, sy2)
        ctx.stroke()
        // Bottom-right
        ctx.beginPath()
        ctx.moveTo(sx2 - cornerSize, sy2)
        ctx.lineTo(sx2, sy2)
        ctx.lineTo(sx2, sy2 - cornerSize)
        ctx.stroke()
      })
    }

    // Draw result indicator (top-right badge)
    if (result) {
      const resultLabel = resultLabels[result] || result.toUpperCase()
      ctx.font = 'bold 16px "Barlow Condensed", sans-serif'
      const labelWidth = ctx.measureText(resultLabel).width + 20

      // Background
      ctx.fillStyle = resultColors[result] || '#484F58'
      ctx.fillRect(w - labelWidth - 12, 12, labelWidth, 28)

      // Text
      ctx.fillStyle = '#050608'
      ctx.textBaseline = 'middle'
      ctx.fillText(resultLabel, w - labelWidth - 2, 26)
    }

    // Draw timestamp
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    ctx.font = '11px "JetBrains Mono", monospace'
    ctx.fillStyle = '#484F58'
    ctx.textBaseline = 'bottom'
    ctx.fillText(timestamp, 8, h - 8)

  }, [imageLoaded, detections, result, dimensions])

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Loading overlay */}
      {!imageLoaded && imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-terminal/80">
          <div className="flex flex-col items-center text-text-tertiary">
            <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mb-2" />
            <span className="font-mono text-xs">LOADING FRAME...</span>
          </div>
        </div>
      )}

      {/* No image placeholder */}
      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-terminal">
          <div className="text-center text-text-tertiary">
            <div className="w-16 h-16 border-2 border-surface-border flex items-center justify-center mb-3 mx-auto">
              <span className="font-mono text-2xl">📷</span>
            </div>
            <div className="font-display text-sm tracking-wider">AWAITING CAMERA FEED</div>
            <div className="font-mono text-xxs text-text-tertiary mt-1">NO SIGNAL</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetectionOverlay

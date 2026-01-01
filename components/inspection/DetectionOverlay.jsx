'use client'

/**
 * Detection Overlay Component
 * Canvas-based overlay showing AI detections on inspection images
 */

import { useRef, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

export function DetectionOverlay({
  imageUrl,
  detections = [],
  result,
  onOverrideClick,
  width = 800,
  height = 600
}) {
  const canvasRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef(null)

  // Colors based on result
  const resultColors = {
    pass: '#22C55E',
    fail: '#EF4444',
    review: '#F59E0B'
  }

  const resultLabels = {
    pass: 'PASS',
    fail: 'FAIL',
    review: 'REVIEW'
  }

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

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = '#152033'
    ctx.fillRect(0, 0, width, height)

    // Draw image if loaded
    if (imageRef.current && imageLoaded) {
      ctx.drawImage(imageRef.current, 0, 0, width, height)
    }

    // Draw detections
    detections.forEach(det => {
      if (!det.bbox || det.bbox.length !== 4) return

      const [x1, y1, x2, y2] = det.bbox
      const confidence = det.confidence || 0

      // Color based on confidence
      const color = confidence >= 0.9 ? '#EF4444' // High confidence = red
        : confidence >= 0.75 ? '#F59E0B' // Medium = orange
          : '#22C55E' // Low = green

      // Draw box
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Draw label background
      const label = `${det.class} ${Math.round(confidence * 100)}%`
      ctx.font = 'bold 14px Inter, sans-serif'
      const labelWidth = ctx.measureText(label).width + 12
      ctx.fillStyle = color
      ctx.fillRect(x1, y1 - 24, labelWidth, 22)

      // Draw label text
      ctx.fillStyle = '#FFFFFF'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x1 + 6, y1 - 13)

      // Draw severity indicator if present
      if (det.severity) {
        const severityColors = {
          critical: '#DC2626',
          major: '#F97316',
          minor: '#FBBF24',
          cosmetic: '#6B7280'
        }
        const sevColor = severityColors[det.severity] || '#6B7280'
        ctx.fillStyle = sevColor
        ctx.beginPath()
        ctx.arc(x2 - 8, y1 + 8, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Draw result indicator
    if (result) {
      const resultLabel = resultLabels[result] || result.toUpperCase()
      ctx.font = 'bold 24px Inter, sans-serif'
      const labelWidth = ctx.measureText(resultLabel).width + 24

      // Background
      ctx.fillStyle = resultColors[result] || '#6B7280'
      ctx.beginPath()
      ctx.roundRect(width - labelWidth - 12, 12, labelWidth, 40, 8)
      ctx.fill()

      // Text
      ctx.fillStyle = '#FFFFFF'
      ctx.textBaseline = 'middle'
      ctx.fillText(resultLabel, width - labelWidth, 32)
    }

  }, [imageLoaded, detections, result, width, height])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg"
      />

      {/* Override Button - appears on fail/review */}
      {(result === 'fail' || result === 'review') && onOverrideClick && (
        <button
          onClick={onOverrideClick}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-indusia-warning hover:bg-indusia-warning/90 text-white rounded-lg font-medium shadow-lg transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Report False Call
        </button>
      )}

      {/* Loading overlay */}
      {!imageLoaded && imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-indusia-bg/80 rounded-lg">
          <div className="flex flex-col items-center text-indusia-textMuted">
            <div className="w-8 h-8 border-2 border-indusia-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span>Loading frame...</span>
          </div>
        </div>
      )}

      {/* No image placeholder */}
      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-indusia-surfaceMuted rounded-lg">
          <div className="text-center text-indusia-textMuted">
            <div className="text-4xl mb-2">📷</div>
            <div>Waiting for camera feed...</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetectionOverlay

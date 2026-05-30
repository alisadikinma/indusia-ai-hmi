'use client'

/**
 * Annotation Canvas Component
 * Canvas-based tool for visual annotation of inspection images
 * Shows AI detections and allows operator to mark actual conditions
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Square, Circle, Pencil, Eraser, Trash2 } from 'lucide-react'

export function AnnotationCanvas({
  imageUrl,
  aiDetections = [],
  initialAnnotations = {},
  onAnnotationChange,
  width = 800,
  height = 600,
  readOnly = false
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tool, setTool] = useState('rectangle') // rectangle, circle, freehand, eraser
  const [marks, setMarks] = useState(initialAnnotations.operator_marks || [])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentMark, setCurrentMark] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef(null)

  // Load image
  useEffect(() => {
    if (!imageUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl)
      setImageLoaded(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Redraw canvas
  const redraw = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Fill background
    ctx.fillStyle = '#152033'
    ctx.fillRect(0, 0, width, height)

    // Draw image if loaded
    if (imageRef.current && imageLoaded) {
      ctx.drawImage(imageRef.current, 0, 0, width, height)
    } else {
      // Placeholder
      ctx.fillStyle = '#1A2942'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#8A95A8'
      ctx.font = '14px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Loading image...', width / 2, height / 2)
    }

    // Draw AI detections (dashed red)
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 2
    aiDetections.forEach(det => {
      if (det.bbox && det.bbox.length === 4) {
        const [x1, y1, x2, y2] = det.bbox
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

        // Label background
        const label = `${det.class} ${Math.round((det.confidence || 0) * 100)}%`
        ctx.font = '12px Inter, sans-serif'
        const textWidth = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
        ctx.fillRect(x1, y1 - 18, textWidth + 8, 16)

        // Label text
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'left'
        ctx.fillText(label, x1 + 4, y1 - 5)
      }
    })

    // Draw operator marks (solid green)
    ctx.setLineDash([])
    ctx.strokeStyle = '#22C55E'
    ctx.lineWidth = 2
    marks.forEach(mark => {
      drawMark(ctx, mark, '#22C55E')
    })

    // Draw current mark being drawn (blue)
    if (currentMark) {
      drawMark(ctx, currentMark, '#3B82F6')
    }
  }, [imageLoaded, aiDetections, marks, currentMark, width, height])

  useEffect(() => {
    redraw()
  }, [redraw])

  const drawMark = (ctx, mark, color) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2

    switch (mark.type) {
      case 'rectangle':
        ctx.strokeRect(mark.x, mark.y, mark.width, mark.height)
        break
      case 'circle':
        ctx.beginPath()
        ctx.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'freehand':
        if (mark.points?.length > 1) {
          ctx.beginPath()
          ctx.moveTo(mark.points[0].x, mark.points[0].y)
          mark.points.forEach(p => ctx.lineTo(p.x, p.y))
          ctx.stroke()
        }
        break
    }

    // Draw label if exists
    if (mark.label && (mark.type === 'rectangle' || mark.type === 'circle')) {
      ctx.fillStyle = color
      ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'left'
      const labelX = mark.type === 'circle' ? mark.x - mark.radius : mark.x
      const labelY = mark.type === 'circle' ? mark.y - mark.radius - 4 : mark.y - 4
      ctx.fillText(mark.label, labelX, labelY)
    }
  }

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleMouseDown = (e) => {
    if (readOnly) return

    const pos = getMousePos(e)
    setIsDrawing(true)

    if (tool === 'eraser') {
      // Find and remove mark at position
      const markIndex = marks.findIndex(m => isPointInMark(pos, m))
      if (markIndex >= 0) {
        const newMarks = marks.filter((_, i) => i !== markIndex)
        setMarks(newMarks)
        onAnnotationChange?.({ ...initialAnnotations, operator_marks: newMarks })
      }
      return
    }

    if (tool === 'rectangle') {
      setCurrentMark({ type: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0 })
    } else if (tool === 'circle') {
      setCurrentMark({ type: 'circle', x: pos.x, y: pos.y, radius: 0 })
    } else if (tool === 'freehand') {
      setCurrentMark({ type: 'freehand', points: [pos] })
    }
  }

  const handleMouseMove = (e) => {
    if (!isDrawing || readOnly || !currentMark) return

    const pos = getMousePos(e)

    if (tool === 'rectangle') {
      setCurrentMark(prev => ({
        ...prev,
        width: pos.x - prev.x,
        height: pos.y - prev.y
      }))
    } else if (tool === 'circle') {
      const dx = pos.x - currentMark.x
      const dy = pos.y - currentMark.y
      setCurrentMark(prev => ({
        ...prev,
        radius: Math.sqrt(dx * dx + dy * dy)
      }))
    } else if (tool === 'freehand') {
      setCurrentMark(prev => ({
        ...prev,
        points: [...prev.points, pos]
      }))
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing || readOnly || !currentMark) {
      setIsDrawing(false)
      return
    }

    // Validate mark has size
    let isValid = false
    if (currentMark.type === 'rectangle') {
      isValid = Math.abs(currentMark.width) > 5 && Math.abs(currentMark.height) > 5
    } else if (currentMark.type === 'circle') {
      isValid = currentMark.radius > 5
    } else if (currentMark.type === 'freehand') {
      isValid = currentMark.points?.length > 2
    }

    if (isValid) {
      const newMark = { ...currentMark, id: Date.now(), label: 'operator_mark' }
      const newMarks = [...marks, newMark]
      setMarks(newMarks)
      onAnnotationChange?.({ ...initialAnnotations, operator_marks: newMarks })
    }

    setCurrentMark(null)
    setIsDrawing(false)
  }

  const isPointInMark = (point, mark) => {
    if (mark.type === 'rectangle') {
      const x = Math.min(mark.x, mark.x + mark.width)
      const y = Math.min(mark.y, mark.y + mark.height)
      const w = Math.abs(mark.width)
      const h = Math.abs(mark.height)
      return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h
    } else if (mark.type === 'circle') {
      const dx = point.x - mark.x
      const dy = point.y - mark.y
      return Math.sqrt(dx * dx + dy * dy) <= mark.radius
    } else if (mark.type === 'freehand' && mark.points?.length > 0) {
      // Simple bounding box check for freehand
      const xs = mark.points.map(p => p.x)
      const ys = mark.points.map(p => p.y)
      const minX = Math.min(...xs) - 10
      const maxX = Math.max(...xs) + 10
      const minY = Math.min(...ys) - 10
      const maxY = Math.max(...ys) + 10
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    }
    return false
  }

  const clearAll = () => {
    setMarks([])
    onAnnotationChange?.({ ...initialAnnotations, operator_marks: [] })
  }

  const tools = [
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'freehand', icon: Pencil, label: 'Freehand' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' }
  ]

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 p-2 bg-indusia-surfaceMuted rounded-lg border border-indusia-border">
          <span className="text-sm font-medium text-indusia-textMuted mr-2">Tools:</span>
          {tools.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  tool === t.id
                    ? 'bg-indusia-primary text-white'
                    : 'bg-indusia-surface text-indusia-textMuted hover:bg-indusia-border hover:text-indusia-text'
                )}
                title={t.label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-indusia-fail/20 text-indusia-fail hover:bg-indusia-fail/30"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="relative border border-indusia-border rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'block',
            !readOnly && 'cursor-crosshair'
          )}
        />

        {!imageLoaded && imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-indusia-bg/80">
            <div className="text-indusia-textMuted">Loading image...</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-indusia-fail"></div>
          <span className="text-indusia-textMuted">AI Detection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-indusia-pass"></div>
          <span className="text-indusia-textMuted">Operator Mark</span>
        </div>
        <div className="flex-1" />
        <div className="text-indusia-textMuted">
          {marks.length} mark{marks.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

export default AnnotationCanvas

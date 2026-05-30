# Phase 3: Enhanced Override UX — Image Annotation System

## Objective
Implement visual annotation tools untuk operator marking false calls dengan bounding box dan drawing tools.

---

## Context

Database sudah updated:
- `override_images.annotations` — JSONB untuk operator marks
- `override_images.ai_detections` — JSONB untuk original AI detections
- `overrides.override_type` — classification type

Override types:
- `false_positive_no_defect` — AI detected but no defect exists
- `false_positive_acceptable` — Defect exists but acceptable
- `misclassification` — Wrong defect class
- `false_negative` — AI missed a defect (manual report)
- `other` — Other reasons

Tech stack: Next.js 14 App Router, JavaScript, Canvas API

---

## Task 1: Update Repository Layer

### 1.1 Update `lib/repos/overridesRepo.js` (add methods)

```javascript
// Add these methods to existing overridesRepo

  // Create override with annotation data
  async createWithAnnotation(data) {
    const { images, ...overrideData } = data
    
    // Create override
    const { data: override, error: overrideError } = await supabase
      .from('overrides')
      .insert(overrideData)
      .select()
      .single()
    
    if (overrideError) return { data: null, error: overrideError }
    
    // Create override images with annotations
    if (images?.length) {
      const imageRecords = images.map(img => ({
        override_id: override.id,
        image_path: img.image_path,
        image_url: img.image_url,
        ai_detections: img.ai_detections || [],
        annotations: img.annotations || {}
      }))
      
      const { error: imgError } = await supabase
        .from('override_images')
        .insert(imageRecords)
      
      if (imgError) return { data: override, error: imgError }
    }
    
    return { data: override, error: null }
  },

  // Update annotations for an override image
  async updateAnnotations(imageId, annotations) {
    return supabase
      .from('override_images')
      .update({ annotations })
      .eq('id', imageId)
      .select()
      .single()
  },

  // Get override with images and annotations
  async getWithImages(id) {
    return supabase
      .from('overrides')
      .select(`
        *,
        override_images (
          id,
          image_path,
          image_url,
          ai_detections,
          annotations
        )
      `)
      .eq('id', id)
      .single()
  }
```

### 1.2 Update `lib/repos/datasetQueueRepo.js` (add auto-queue logic)

```javascript
// Add method for auto-queueing based on override type

  async autoQueueFromOverride(override) {
    const actionMap = {
      'false_positive_no_defect': 'add_negative',
      'false_positive_acceptable': 'add_negative', 
      'misclassification': 'correct_label',
      'false_negative': 'add_positive',
      'other': null
    }
    
    const action = actionMap[override.override_type]
    if (!action) return { data: null, error: null } // skip 'other'
    
    return this.add({
      override_id: override.id,
      training_action: action,
      priority: override.override_type === 'false_negative' ? 10 : 0 // prioritize false negatives
    })
  }
```

---

## Task 2: Create Annotation Components

### 2.1 `components/override/AnnotationCanvas.jsx`

```javascript
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

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
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Redraw canvas
  const redraw = useCallback(() => {
    if (!canvasRef.current || !imageLoaded) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Clear and draw image
    ctx.clearRect(0, 0, width, height)
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, width, height)
    }
    
    // Draw AI detections (dashed red)
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 2
    aiDetections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      
      // Label
      ctx.fillStyle = '#EF4444'
      ctx.font = '12px Inter, sans-serif'
      ctx.fillText(`${det.class} ${Math.round(det.confidence * 100)}%`, x1, y1 - 4)
    })
    
    // Draw operator marks (solid green)
    ctx.setLineDash([])
    ctx.strokeStyle = '#22C55E'
    ctx.lineWidth = 2
    marks.forEach(mark => {
      drawMark(ctx, mark)
    })
    
    // Draw current mark being drawn
    if (currentMark) {
      ctx.strokeStyle = '#3B82F6'
      drawMark(ctx, currentMark)
    }
  }, [imageLoaded, aiDetections, marks, currentMark, width, height])

  useEffect(() => {
    redraw()
  }, [redraw])

  const drawMark = (ctx, mark) => {
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
    if (mark.label) {
      ctx.fillStyle = ctx.strokeStyle
      ctx.font = '11px Inter, sans-serif'
      ctx.fillText(mark.label, mark.x, mark.y - 4)
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
      return point.x >= mark.x && point.x <= mark.x + mark.width &&
             point.y >= mark.y && point.y <= mark.y + mark.height
    } else if (mark.type === 'circle') {
      const dx = point.x - mark.x
      const dy = point.y - mark.y
      return Math.sqrt(dx * dx + dy * dy) <= mark.radius
    }
    return false
  }

  const clearAll = () => {
    setMarks([])
    onAnnotationChange?.({ ...initialAnnotations, operator_marks: [] })
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
          <span className="text-sm font-medium mr-2">Tools:</span>
          {[
            { id: 'rectangle', icon: '□', label: 'Rectangle' },
            { id: 'circle', icon: '○', label: 'Circle' },
            { id: 'freehand', icon: '✎', label: 'Freehand' },
            { id: 'eraser', icon: '⌫', label: 'Eraser' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tool === t.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white hover:bg-gray-200'
              }`}
              title={t.label}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded text-sm bg-red-100 text-red-600 hover:bg-red-200"
          >
            Clear All
          </button>
        </div>
      )}
      
      {/* Canvas */}
      <div className="relative border rounded-lg overflow-hidden bg-gray-900">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`${readOnly ? '' : 'cursor-crosshair'}`}
        />
        
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-white">Loading image...</div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-red-500 border-dashed border-red-500" style={{ borderStyle: 'dashed' }}></div>
          <span>AI Detection</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-green-500"></div>
          <span>Operator Mark</span>
        </div>
      </div>
    </div>
  )
}
```

### 2.2 `components/override/OverrideWizard.jsx`

```javascript
'use client'

import { useState } from 'react'
import { AnnotationCanvas } from './AnnotationCanvas'

const OVERRIDE_TYPES = [
  { 
    value: 'false_positive_no_defect', 
    label: 'False Positive - No Defect',
    description: 'AI detected a defect but there is no actual defect',
    trainingAction: 'Will be added as negative sample'
  },
  { 
    value: 'false_positive_acceptable', 
    label: 'False Positive - Acceptable',
    description: 'Defect exists but is within acceptable tolerance',
    trainingAction: 'Will be added as acceptable sample'
  },
  { 
    value: 'misclassification', 
    label: 'AI Misclassification',
    description: 'AI detected wrong defect type',
    trainingAction: 'Will correct the label for training'
  },
  { 
    value: 'false_negative', 
    label: 'False Negative (Missed Defect)',
    description: 'AI missed a defect that exists',
    trainingAction: 'Will be added as positive sample (priority)'
  },
  { 
    value: 'other', 
    label: 'Other',
    description: 'Other reason',
    trainingAction: 'Manual review required'
  }
]

export function OverrideWizard({ 
  boardId,
  imageUrl, 
  aiDetections = [],
  onSubmit,
  onCancel 
}) {
  const [step, setStep] = useState(1)
  const [annotations, setAnnotations] = useState({ operator_marks: [] })
  const [overrideType, setOverrideType] = useState('')
  const [correctClass, setCorrectClass] = useState('') // for misclassification
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit({
        board_id: boardId,
        override_type: overrideType,
        reason,
        correct_class: overrideType === 'misclassification' ? correctClass : null,
        images: [{
          image_url: imageUrl,
          ai_detections: aiDetections,
          annotations: annotations
        }]
      })
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedStep2 = annotations.operator_marks?.length > 0 || overrideType === 'false_negative'
  const canProceedStep3 = overrideType !== ''
  const canSubmit = canProceedStep3 && reason.trim().length > 0

  return (
    <div className="bg-white rounded-xl border shadow-lg max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h2 className="text-xl font-bold">False Call Override</h2>
        <p className="text-gray-500 text-sm">Board: {boardId}</p>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-4">
          {[
            { num: 1, label: 'Review & Annotate' },
            { num: 2, label: 'Classify Override' },
            { num: 3, label: 'Submit' }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s.num}
              </div>
              <span className={`ml-2 text-sm ${step >= s.num ? 'text-gray-900' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {idx < 2 && <div className="w-8 h-px bg-gray-300 mx-3" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Step 1: Review & Annotate */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Review AI Detection & Mark Your Assessment</h3>
              <p className="text-sm text-gray-600 mb-4">
                Red dashed boxes show AI detections. Use the tools to mark the actual condition.
              </p>
            </div>
            
            <AnnotationCanvas
              imageUrl={imageUrl}
              aiDetections={aiDetections}
              initialAnnotations={annotations}
              onAnnotationChange={setAnnotations}
              width={700}
              height={500}
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep2}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Classify
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Classify Override */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 2: Select Override Type</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose the reason for this override. This affects how the AI will be retrained.
              </p>
            </div>
            
            <div className="space-y-3">
              {OVERRIDE_TYPES.map(type => (
                <label 
                  key={type.value}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    overrideType === type.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="overrideType"
                      value={type.value}
                      checked={overrideType === type.value}
                      onChange={(e) => setOverrideType(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                      <div className="text-xs text-blue-600 mt-1">→ {type.trainingAction}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Correct class selector for misclassification */}
            {overrideType === 'misclassification' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Correct Defect Class:</label>
                <select
                  value={correctClass}
                  onChange={(e) => setCorrectClass(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select correct class...</option>
                  <option value="solder_bridge">Solder Bridge</option>
                  <option value="scratch">Scratch</option>
                  <option value="missing_component">Missing Component</option>
                  <option value="misalignment">Misalignment</option>
                  <option value="contamination">Contamination</option>
                </select>
              </div>
            )}
            
            <div className="flex justify-between gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep3}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Review & Submit
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 3: Review & Submit</h3>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Override Type:</span>
                <span className="font-medium">
                  {OVERRIDE_TYPES.find(t => t.value === overrideType)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Annotations:</span>
                <span className="font-medium">{annotations.operator_marks?.length || 0} marks</span>
              </div>
              {correctClass && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Correct Class:</span>
                  <span className="font-medium">{correctClass}</span>
                </div>
              )}
            </div>
            
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Reason / Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this is a false call..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            
            <div className="flex justify-between gap-3 mt-6">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Override'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Task 3: Update API Routes

### 3.1 Update `app/api/overrides/route.js` - Enhanced POST

```javascript
import { overridesRepo } from '@/lib/repos/overridesRepo'
import { datasetQueueRepo } from '@/lib/repos/datasetQueueRepo'
import { eventLogRepo } from '@/lib/repos/eventLogRepo'

export async function POST(request) {
  const body = await request.json()
  
  // Create override with annotations
  const { data: override, error } = await overridesRepo.createWithAnnotation({
    board_id: body.board_id,
    section_id: body.section_id,
    line_id: body.line_id,
    override_type: body.override_type,
    reason: body.reason,
    correct_class: body.correct_class,
    submitted_by: body.submitted_by,
    submitted_by_name: body.submitted_by_name,
    status: 'pending',
    images: body.images
  })
  
  if (error) return Response.json({ error: error.message }, { status: 500 })
  
  // Auto-queue for training (based on override type)
  await datasetQueueRepo.autoQueueFromOverride(override)
  
  // Log event
  await eventLogRepo.log({
    type: 'override_submitted',
    source: 'operator_hmi',
    user_id: body.submitted_by,
    user_name: body.submitted_by_name,
    details: { 
      override_id: override.id, 
      override_type: body.override_type,
      board_id: body.board_id
    }
  })
  
  return Response.json(override, { status: 201 })
}
```

---

## Task 4: Create Override Submission Page/Modal

### 4.1 `components/override/OverrideModal.jsx`

```javascript
'use client'

import { OverrideWizard } from './OverrideWizard'

export function OverrideModal({ 
  isOpen, 
  onClose, 
  boardId, 
  imageUrl, 
  aiDetections,
  sectionId,
  lineId,
  user 
}) {
  if (!isOpen) return null

  const handleSubmit = async (data) => {
    const response = await fetch('/api/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        section_id: sectionId,
        line_id: lineId,
        submitted_by: user?.id,
        submitted_by_name: user?.name
      })
    })

    if (response.ok) {
      onClose()
      // Show success toast or notification
    } else {
      // Handle error
      const error = await response.json()
      alert(error.error || 'Failed to submit override')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 max-h-[90vh] overflow-y-auto">
        <OverrideWizard
          boardId={boardId}
          imageUrl={imageUrl}
          aiDetections={aiDetections}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
```

---

## Verification Checklist

1. [ ] AnnotationCanvas loads image correctly
2. [ ] AI detections displayed as red dashed boxes
3. [ ] Rectangle tool draws correctly
4. [ ] Circle tool draws correctly
5. [ ] Freehand tool draws correctly
6. [ ] Eraser removes marks
7. [ ] Clear All removes all marks
8. [ ] OverrideWizard step navigation works
9. [ ] Override type selection works
10. [ ] Correct class selector appears for misclassification
11. [ ] Submit creates override with annotations
12. [ ] Auto-queue to dataset_queue works
13. [ ] Event log entry created

---

## Notes

- Canvas menggunakan native Canvas API untuk performance
- Annotation data disimpan sebagai JSONB untuk flexibility
- Auto-queue ke training berdasarkan override_type
- Sesuaikan defect class options dengan data dari `defect_classes` table
- Modal dapat digunakan dari Live Inspection view atau dari list

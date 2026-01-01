'use client'

/**
 * Override Wizard Component
 * Multi-step wizard for submitting false call overrides with annotations
 */

import { useState, useEffect } from 'react'
import { AnnotationCanvas } from './AnnotationCanvas'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Info } from 'lucide-react'

const OVERRIDE_TYPES = [
  {
    value: 'false_positive_no_defect',
    label: 'False Positive - No Defect',
    description: 'AI detected a defect but there is no actual defect',
    trainingAction: 'Will be added as negative sample',
    color: 'bg-green-500'
  },
  {
    value: 'false_positive_acceptable',
    label: 'False Positive - Acceptable',
    description: 'Defect exists but is within acceptable tolerance',
    trainingAction: 'Will be added as acceptable sample',
    color: 'bg-yellow-500'
  },
  {
    value: 'misclassification',
    label: 'AI Misclassification',
    description: 'AI detected wrong defect type',
    trainingAction: 'Will correct the label for training',
    color: 'bg-orange-500'
  },
  {
    value: 'false_negative',
    label: 'False Negative (Missed Defect)',
    description: 'AI missed a defect that exists',
    trainingAction: 'Will be added as positive sample (priority)',
    color: 'bg-red-500'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other reason not covered above',
    trainingAction: 'Manual review required',
    color: 'bg-gray-500'
  }
]

// Common defect classes - ideally fetched from API
const DEFECT_CLASSES = [
  { value: 'solder_bridge', label: 'Solder Bridge' },
  { value: 'scratch', label: 'Scratch' },
  { value: 'missing_component', label: 'Missing Component' },
  { value: 'misalignment', label: 'Misalignment' },
  { value: 'contamination', label: 'Contamination' },
  { value: 'cold_solder', label: 'Cold Solder' },
  { value: 'lifted_lead', label: 'Lifted Lead' },
  { value: 'tombstone', label: 'Tombstone' },
  { value: 'insufficient_solder', label: 'Insufficient Solder' },
  { value: 'excess_solder', label: 'Excess Solder' }
]

export function OverrideWizard({
  boardId,
  imageUrl,
  aiDetections = [],
  defectClasses = DEFECT_CLASSES,
  onSubmit,
  onCancel
}) {
  const [step, setStep] = useState(1)
  const [annotations, setAnnotations] = useState({ operator_marks: [] })
  const [overrideType, setOverrideType] = useState('')
  const [correctClass, setCorrectClass] = useState('') // for misclassification
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Validation
  const canProceedStep2 = annotations.operator_marks?.length > 0 || overrideType === 'false_negative'
  const canProceedStep3 = overrideType !== '' && (overrideType !== 'misclassification' || correctClass !== '')
  const canSubmit = canProceedStep3 && reason.trim().length >= 5

  const handleSubmit = async () => {
    if (!canSubmit) return

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
    } catch (error) {
      console.error('Override submission failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    { num: 1, label: 'Review & Annotate' },
    { num: 2, label: 'Classify Override' },
    { num: 3, label: 'Submit' }
  ]

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border shadow-xl max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-indusia-border px-6 py-4">
        <h2 className="text-xl font-bold text-indusia-text">False Call Override</h2>
        <p className="text-indusia-textMuted text-sm">Board: {boardId}</p>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-3 bg-indusia-surfaceMuted border-b border-indusia-border">
        <div className="flex items-center gap-2">
          {steps.map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step > s.num && 'bg-indusia-pass text-white',
                  step === s.num && 'bg-indusia-primary text-white',
                  step < s.num && 'bg-indusia-border text-indusia-textMuted'
                )}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm hidden sm:inline',
                  step >= s.num ? 'text-indusia-text' : 'text-indusia-textMuted'
                )}
              >
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <div className="w-8 h-px bg-indusia-border mx-3" />
              )}
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
              <h3 className="font-semibold text-indusia-text mb-2">
                Step 1: Review AI Detection & Mark Your Assessment
              </h3>
              <p className="text-sm text-indusia-textMuted mb-4">
                Red dashed boxes show AI detections. Use the drawing tools to mark the actual condition.
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

            {!canProceedStep2 && (
              <div className="flex items-center gap-2 p-3 bg-indusia-warning/10 border border-indusia-warning/30 rounded-lg text-sm text-indusia-warning">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Draw at least one mark to indicate the actual condition, or select "False Negative" in the next step.</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-indusia-border rounded-lg text-indusia-textMuted hover:bg-indusia-surfaceMuted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 bg-indusia-primary text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Next: Classify
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Classify Override */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-indusia-text mb-2">
                Step 2: Select Override Type
              </h3>
              <p className="text-sm text-indusia-textMuted mb-4">
                Choose the reason for this override. This affects how the AI model will be retrained.
              </p>
            </div>

            <div className="space-y-3">
              {OVERRIDE_TYPES.map(type => (
                <label
                  key={type.value}
                  className={cn(
                    'block p-4 border rounded-lg cursor-pointer transition-colors',
                    overrideType === type.value
                      ? 'border-indusia-primary bg-indusia-primary/10'
                      : 'border-indusia-border hover:border-indusia-textMuted'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="overrideType"
                      value={type.value}
                      checked={overrideType === type.value}
                      onChange={(e) => setOverrideType(e.target.value)}
                      className="mt-1 accent-indusia-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', type.color)} />
                        <span className="font-medium text-indusia-text">{type.label}</span>
                      </div>
                      <div className="text-sm text-indusia-textMuted mt-1">{type.description}</div>
                      <div className="text-xs text-indusia-primary mt-1">
                        → {type.trainingAction}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Correct class selector for misclassification */}
            {overrideType === 'misclassification' && (
              <div className="mt-4 p-4 bg-indusia-surfaceMuted rounded-lg border border-indusia-border">
                <label className="block text-sm font-medium text-indusia-text mb-2">
                  Correct Defect Class: <span className="text-indusia-fail">*</span>
                </label>
                <select
                  value={correctClass}
                  onChange={(e) => setCorrectClass(e.target.value)}
                  className="w-full bg-indusia-surface border border-indusia-border rounded-lg px-3 py-2 text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">Select correct class...</option>
                  {defectClasses.map(dc => (
                    <option key={dc.value} value={dc.value}>{dc.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-between gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 border border-indusia-border rounded-lg text-indusia-textMuted hover:bg-indusia-surfaceMuted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep3}
                className="flex items-center gap-2 px-4 py-2 bg-indusia-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Review & Submit
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-indusia-text mb-2">
                Step 3: Review & Submit
              </h3>
            </div>

            {/* Summary */}
            <div className="bg-indusia-surfaceMuted rounded-lg p-4 space-y-3 border border-indusia-border">
              <div className="flex justify-between">
                <span className="text-indusia-textMuted">Override Type:</span>
                <span className="font-medium text-indusia-text">
                  {OVERRIDE_TYPES.find(t => t.value === overrideType)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-indusia-textMuted">Annotations:</span>
                <span className="font-medium text-indusia-text">
                  {annotations.operator_marks?.length || 0} marks
                </span>
              </div>
              {correctClass && (
                <div className="flex justify-between">
                  <span className="text-indusia-textMuted">Correct Class:</span>
                  <span className="font-medium text-indusia-text">
                    {defectClasses.find(dc => dc.value === correctClass)?.label || correctClass}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-indusia-textMuted">Training Action:</span>
                <span className="font-medium text-indusia-primary">
                  {OVERRIDE_TYPES.find(t => t.value === overrideType)?.trainingAction}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-indusia-text mb-2">
                Reason / Notes <span className="text-indusia-fail">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this is a false call (minimum 5 characters)..."
                rows={3}
                className="w-full bg-indusia-surface border border-indusia-border rounded-lg px-3 py-2 text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary resize-none"
              />
              <p className="text-xs text-indusia-textMuted mt-1">
                {reason.length}/5 characters minimum
              </p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-indusia-warning/10 border border-indusia-warning/30 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-indusia-warning flex-shrink-0 mt-0.5" />
              <span className="text-indusia-warning">
                This override will be queued for manager review. Once approved, it will be used to improve AI model accuracy.
              </span>
            </div>

            <div className="flex justify-between gap-3 pt-4">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 border border-indusia-border rounded-lg text-indusia-textMuted hover:bg-indusia-surfaceMuted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="flex items-center gap-2 px-6 py-2 bg-indusia-pass text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Submit Override
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OverrideWizard

'use client'

/**
 * Override Modal Component
 * Modal wrapper for the Override Wizard
 * Handles API submission and success/error states
 */

import { useState } from 'react'
import { OverrideWizard } from './OverrideWizard'
import { X } from 'lucide-react'

export function OverrideModal({
  isOpen,
  onClose,
  boardId,
  imageUrl,
  aiDetections = [],
  sectionId,
  lineId,
  customerId,
  user,
  onSuccess
}) {
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (data) => {
    setError(null)

    try {
      const response = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          section_id: sectionId,
          line_id: lineId,
          customer_id: customerId,
          submitted_by: user?.id,
          submitted_by_name: user?.name || user?.username
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit override')
      }

      // Success
      onSuccess?.(result.data)
      onClose()
    } catch (err) {
      console.error('Override submission failed:', err)
      setError(err.message || 'Failed to submit override. Please try again.')
    }
  }

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 max-h-[90vh] overflow-y-auto w-full max-w-4xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-indusia-surface/80 text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surface transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Error banner */}
        {error && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-indusia-fail text-white px-4 py-2 text-sm rounded-t-xl">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

export default OverrideModal

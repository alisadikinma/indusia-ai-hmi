'use client'

import { useState, useCallback } from 'react'
import { authFetch, getAuthHeaders } from '@/lib/utils/authFetch'

/**
 * Hook for handling image uploads to the API
 */
export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  /**
   * Upload images for an override
   * @param {File[]} files - Array of files to upload
   * @param {Object} metadata - Upload metadata
   * @param {string} metadata.overrideId - Override ID
   * @param {string} metadata.sectionId - Section ID
   * @param {string} metadata.boardId - Board ID
   * @param {string} metadata.userId - User ID
   * @returns {Promise<Array>} Array of uploaded image records
   */
  const uploadImages = useCallback(async (files, metadata) => {
    if (!files || files.length === 0) {
      setError('No files to upload')
      return []
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('override_id', metadata.overrideId)
      formData.append('section_id', metadata.sectionId || '')
      formData.append('board_id', metadata.boardId || '')
      formData.append('user_id', metadata.userId || '')

      // Simulate progress (since fetch doesn't support progress for uploads easily)
      setProgress(30)

      // Get auth headers but remove Content-Type (FormData sets its own)
      const headers = getAuthHeaders()
      delete headers['Content-Type']

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers,
        body: formData
      })

      setProgress(70)

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Upload failed')
      }

      setProgress(100)
      return json.data || []
    } catch (err) {
      console.error('[useImageUpload] Error:', err)
      setError(err.message || 'Failed to upload images')
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  /**
   * Get images for an override
   * @param {string} overrideId - Override ID
   * @returns {Promise<Array>}
   */
  const getImages = useCallback(async (overrideId) => {
    try {
      const res = await authFetch(`/api/images/${overrideId}`)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch images')
      }

      return json.data || []
    } catch (err) {
      console.error('[useImageUpload.getImages] Error:', err)
      return []
    }
  }, [])

  /**
   * Delete all images for an override
   * @param {string} overrideId - Override ID
   * @returns {Promise<boolean>}
   */
  const deleteImages = useCallback(async (overrideId) => {
    try {
      const res = await authFetch(`/api/images/${overrideId}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      return json.success
    } catch (err) {
      console.error('[useImageUpload.deleteImages] Error:', err)
      return false
    }
  }, [])

  const reset = useCallback(() => {
    setUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  return {
    uploadImages,
    getImages,
    deleteImages,
    uploading,
    progress,
    error,
    reset
  }
}

export default useImageUpload

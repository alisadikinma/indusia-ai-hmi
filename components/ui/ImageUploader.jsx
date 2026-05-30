'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'

/**
 * Image Uploader Component
 * Supports drag-and-drop, multiple files, previews, and validation
 */
export function ImageUploader({
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = 'image/jpeg,image/png,image/webp',
  disabled = false,
  initialFiles = []
}) {
  const [files, setFiles] = useState(initialFiles)
  const [previews, setPreviews] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const validateFiles = useCallback((selectedFiles) => {
    const errors = []
    const validFiles = []
    const acceptedTypes = accept.split(',').map(t => t.trim())

    for (const file of selectedFiles) {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`)
        continue
      }

      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: Exceeds ${maxSizeMB}MB limit`)
        continue
      }

      validFiles.push(file)
    }

    return { validFiles, errors }
  }, [accept, maxSizeMB])

  const createPreviews = useCallback((newFiles) => {
    newFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews(prev => [...prev, {
          file,
          url: e.target.result,
          name: file.name
        }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFileSelect = useCallback((selectedFiles) => {
    const fileArray = Array.from(selectedFiles)

    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    const { validFiles, errors } = validateFiles(fileArray)

    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    const newFiles = [...files, ...validFiles]
    setFiles(newFiles)
    createPreviews(validFiles)
    setError(null)

    if (onFilesChange) {
      onFilesChange(newFiles)
    }
  }, [files, maxFiles, validateFiles, createPreviews, onFilesChange])

  const handleInputChange = (e) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setFiles(newFiles)
    setPreviews(newPreviews)
    setError(null)

    if (onFilesChange) {
      onFilesChange(newFiles)
    }
  }

  const clearAll = () => {
    setFiles([])
    setPreviews([])
    setError(null)
    if (onFilesChange) {
      onFilesChange([])
    }
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${dragActive
            ? 'border-indusia-primary bg-indusia-primary/10'
            : 'border-indusia-border hover:border-indusia-primary/50 bg-indusia-surfaceMuted'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <Upload className={`w-8 h-8 ${dragActive ? 'text-indusia-primary' : 'text-indusia-textMuted'}`} />
          <p className="text-sm text-indusia-text">
            <span className="font-medium text-indusia-primary">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-indusia-textMuted">
            JPEG, PNG, WebP up to {maxSizeMB}MB (max {maxFiles} files)
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-indusia-text">
              {previews.length} file{previews.length !== 1 ? 's' : ''} selected
            </p>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-xs text-indusia-textMuted hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {previews.map((preview, index) => (
              <div
                key={index}
                className="relative group aspect-square rounded-lg overflow-hidden border border-indusia-border bg-indusia-bg"
              >
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="w-full h-full object-cover"
                />

                {/* Remove button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* File name tooltip */}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">{preview.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact inline image uploader for forms
 */
export function InlineImageUploader({
  files,
  onFilesChange,
  uploading,
  maxFiles = 5
}) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    if (e.target.files) {
      const newFiles = [...files, ...Array.from(e.target.files)].slice(0, maxFiles)
      onFilesChange(newFiles)
    }
    e.target.value = ''
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || files.length >= maxFiles}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-indusia-surfaceMuted border border-indusia-border rounded-lg hover:bg-indusia-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          Add Images ({files.length}/{maxFiles})
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-2 py-1 bg-indusia-surfaceMuted border border-indusia-border rounded text-xs"
            >
              <span className="text-indusia-text truncate max-w-[120px]">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={uploading}
                className="text-indusia-textMuted hover:text-red-400 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageUploader

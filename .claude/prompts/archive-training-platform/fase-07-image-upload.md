# FASE 7: Image Upload & Storage

## Role
You are a senior full-stack developer implementing image upload functionality for INDUSIA AI HMI - enabling operators to attach defect images to false-call overrides for ML training dataset.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Storage for image files
- Database table `override_images` ready
- Images will be used for ML training dataset later

Project files for reference:
- `indusia_schema_v1.md` - `override_images` table structure
- `components/inspection/FalseCallOverrideModal.jsx` - Where upload will be added

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

Supabase Storage bucket to create: `inspection-images`

## Objective
Implement image upload untuk false-call overrides dengan proper storage structure dan database tracking.

## Storage Structure
```
inspection-images/
└── false-call-overrides/
    └── {section_id}/
        └── {board_id}/
            └── {timestamp}-{index}.jpg
```

Example: `false-call-overrides/sec-smt/board-A/2024-01-15T10-30-00Z-0.jpg`

## Tasks

### 7.1 Setup Supabase Storage Bucket
Run in Supabase SQL Editor:
```sql
-- Create bucket via Supabase Dashboard or:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-images',
  'inspection-images',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS: Authenticated uploads
CREATE POLICY "Auth uploads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-images');

-- RLS: Public read
CREATE POLICY "Public read" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'inspection-images');
```

### 7.2 Create Image Storage Repository
Create `lib/repos/imageStorageRepo.js`:

```js
import { supabase } from '@/lib/supabaseClient'

export async function uploadImage(file, path) {
  const { data, error } = await supabase.storage
    .from('inspection-images')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600'
    })
  
  if (error) throw error
  
  const { data: urlData } = supabase.storage
    .from('inspection-images')
    .getPublicUrl(data.path)
  
  return {
    storagePath: data.path,
    publicUrl: urlData.publicUrl
  }
}

export async function uploadOverrideImages(files, overrideId, sectionId, boardId, userId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const results = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()
    const path = `false-call-overrides/${sectionId}/${boardId}/${timestamp}-${i}.${ext}`
    
    const { storagePath, publicUrl } = await uploadImage(file, path)
    
    // Save to database
    const { data, error } = await supabase
      .from('override_images')
      .insert({
        override_id: overrideId,
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userId
      })
      .select()
      .single()
    
    if (error) throw error
    results.push(data)
  }
  
  return results
}

export async function getImagesByOverride(overrideId) {
  const { data, error } = await supabase
    .from('override_images')
    .select('*')
    .eq('override_id', overrideId)
    .order('created_at', { ascending: true })
  
  if (error) throw error
  return data
}

export async function deleteImage(imageId) {
  // Get image record first
  const { data: image } = await supabase
    .from('override_images')
    .select('storage_path')
    .eq('id', imageId)
    .single()
  
  // Delete from storage
  await supabase.storage
    .from('inspection-images')
    .remove([image.storage_path])
  
  // Delete from database
  await supabase
    .from('override_images')
    .delete()
    .eq('id', imageId)
  
  return true
}
```

### 7.3 Create Image Upload API Routes
Create `app/api/images/upload/route.js`:

```js
import { NextResponse } from 'next/server'
import * as imageRepo from '@/lib/repos/imageStorageRepo'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')
    const overrideId = formData.get('override_id')
    const sectionId = formData.get('section_id')
    const boardId = formData.get('board_id')
    const userId = formData.get('user_id')
    
    const images = await imageRepo.uploadOverrideImages(
      files, overrideId, sectionId, boardId, userId
    )
    
    return NextResponse.json({ success: true, data: images })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

Create `app/api/images/[overrideId]/route.js`:

```js
// GET /api/images/:overrideId - Get images for override
```

### 7.4 Create Image Uploader Component
Create `components/ui/ImageUploader.jsx`:

```jsx
'use client'
import { useState, useCallback } from 'react'

export function ImageUploader({ 
  onUpload, 
  maxFiles = 5, 
  maxSizeMB = 10,
  accept = 'image/jpeg,image/png,image/webp'
}) {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    
    // Validate
    if (selectedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }
    
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File ${file.name} exceeds ${maxSizeMB}MB limit`)
        return false
      }
      return true
    })
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target.result])
      }
      reader.readAsDataURL(file)
    })
    
    setFiles(prev => [...prev, ...validFiles])
    setError(null)
  }
  
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }
  
  const uploadFiles = async () => {
    if (files.length === 0) return
    
    setUploading(true)
    try {
      await onUpload(files)
      setFiles([])
      setPreviews([])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div className="image-uploader">
      {/* Dropzone */}
      {/* Preview grid */}
      {/* Upload button */}
      {/* Error display */}
    </div>
  )
}
```

### 7.5 Create useImageUpload Hook
Create `hooks/useImageUpload.js`:

```js
import { useState } from 'react'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  
  const uploadImages = async (files, metadata) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    
    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('override_id', metadata.overrideId)
      formData.append('section_id', metadata.sectionId)
      formData.append('board_id', metadata.boardId)
      formData.append('user_id', metadata.userId)
      
      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      })
      
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      
      setProgress(100)
      return json.data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setUploading(false)
    }
  }
  
  return { uploadImages, uploading, progress, error }
}
```

### 7.6 Integrate into FalseCallOverrideModal
Modify `components/inspection/FalseCallOverrideModal.jsx`:

- Add ImageUploader component
- After override created, upload images with override_id
- Show image previews in modal
- Handle upload errors gracefully

## Constraints
- Max 5 images per override
- Max 10MB per image
- Accepted formats: JPEG, PNG, WebP
- Images are public (for ML pipeline access)
- Non-blocking upload (don't fail override if image upload fails)

## Output Files
```
lib/repos/
└── imageStorageRepo.js

app/api/images/
├── upload/route.js
└── [overrideId]/route.js

components/ui/
└── ImageUploader.jsx

hooks/
└── useImageUpload.js

components/inspection/
└── FalseCallOverrideModal.jsx (modify)
```

## Validation Checklist
- [ ] Can select multiple images
- [ ] Preview shows before upload
- [ ] Can remove image before upload
- [ ] Upload progress indicator works
- [ ] Images saved to Supabase Storage
- [ ] Image records saved to database
- [ ] Images display in override detail view
- [ ] File size validation works
- [ ] File type validation works

## Estimated Time
3-4 hours

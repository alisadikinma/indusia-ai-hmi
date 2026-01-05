import { NextResponse } from 'next/server'
import * as imageRepo from '@/lib/repos/imageStorageRepo'
import { withAuth } from '@/lib/auth/apiAuth'

// Magic bytes for image type validation
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header
}

/**
 * Validate file type using magic bytes (file signature)
 * This prevents MIME type spoofing attacks
 */
async function validateMagicBytes(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 12))
  
  // Check JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }
  
  // Check PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png'
  }
  
  // Check WebP (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  
  return null
}

/**
 * POST /api/images/upload
 * Upload images for an override
 * Requires images:upload permission
 */
async function handlePOST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')
    const overrideId = formData.get('override_id')
    const sectionId = formData.get('section_id')
    const boardId = formData.get('board_id')

    // Validate required fields
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!overrideId) {
      return NextResponse.json(
        { success: false, error: 'override_id is required' },
        { status: 400 }
      )
    }

    // Max 5 files per upload
    if (files.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 files allowed per upload' },
        { status: 400 }
      )
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    const validatedFiles = []

    // Validate each file
    for (const file of files) {
      // Check size first (before reading content)
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }

      // Validate MIME type from header (first check)
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` },
          { status: 400 }
        )
      }

      // SECURITY: Validate magic bytes (prevents MIME spoofing)
      const detectedType = await validateMagicBytes(file)
      if (!detectedType) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} is not a valid image (magic bytes check failed)` },
          { status: 400 }
        )
      }

      if (detectedType !== file.type) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} type mismatch: claimed ${file.type}, detected ${detectedType}` },
          { status: 400 }
        )
      }

      validatedFiles.push(file)
    }

    const images = await imageRepo.uploadOverrideImages(
      validatedFiles,
      overrideId,
      sectionId || 'default',
      boardId || 'default',
      request.user?.id
    )

    return NextResponse.json({
      success: true,
      data: images,
      message: `${images.length} image(s) uploaded successfully`
    })
  } catch (error) {
    console.error('[POST /api/images/upload] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload images' },
      { status: 500 }
    )
  }
}

// Apply authentication - requires images:upload permission
export const POST = withAuth('images:upload')(handlePOST)

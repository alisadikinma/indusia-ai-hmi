import { NextResponse } from 'next/server'
import * as imageRepo from '@/lib/repos/imageStorageRepo'

/**
 * POST /api/images/upload
 * Upload images for an override
 */
export async function POST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')
    const overrideId = formData.get('override_id')
    const sectionId = formData.get('section_id')
    const boardId = formData.get('board_id')
    const userId = formData.get('user_id')

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

    // Validate file types and sizes
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` },
          { status: 400 }
        )
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }
    }

    // Max 5 files per upload
    if (files.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 files allowed per upload' },
        { status: 400 }
      )
    }

    const images = await imageRepo.uploadOverrideImages(
      files,
      overrideId,
      sectionId || 'default',
      boardId || 'default',
      userId
    )

    return NextResponse.json({
      success: true,
      data: images,
      message: `${images.length} image(s) uploaded successfully`
    })
  } catch (error) {
    console.error('[POST /api/images/upload] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload images' },
      { status: 500 }
    )
  }
}

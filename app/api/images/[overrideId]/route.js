import { NextResponse } from 'next/server'
import * as imageRepo from '@/lib/repos/imageStorageRepo'

/**
 * GET /api/images/:overrideId
 * Get all images for an override
 */
export async function GET(request, { params }) {
  try {
    const { overrideId } = params

    if (!overrideId) {
      return NextResponse.json(
        { success: false, error: 'overrideId is required' },
        { status: 400 }
      )
    }

    const images = await imageRepo.getImagesByOverride(overrideId)

    return NextResponse.json({
      success: true,
      data: images
    })
  } catch (error) {
    console.error('[GET /api/images/:overrideId] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/images/:overrideId
 * Delete all images for an override
 */
export async function DELETE(request, { params }) {
  try {
    const { overrideId } = params

    if (!overrideId) {
      return NextResponse.json(
        { success: false, error: 'overrideId is required' },
        { status: 400 }
      )
    }

    const success = await imageRepo.deleteImagesByOverride(overrideId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete images' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Images deleted successfully'
    })
  } catch (error) {
    console.error('[DELETE /api/images/:overrideId] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete images' },
      { status: 500 }
    )
  }
}

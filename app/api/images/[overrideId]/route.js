import { NextResponse } from 'next/server'
import * as imageRepo from '@/lib/repos/imageStorageRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { isValidId } from '@/lib/utils/sanitize'

/**
 * GET /api/images/:overrideId
 * Get all images for an override
 * Requires images:read permission
 */
async function handleGET(request, { params }) {
  try {
    const { overrideId } = params

    if (!overrideId || !isValidId(overrideId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid overrideId' },
        { status: 400 }
      )
    }

    const images = await imageRepo.getImagesByOverride(overrideId)

    return NextResponse.json({
      success: true,
      data: images
    })
  } catch (error) {
    console.error('[GET /api/images/[overrideId]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/images/:overrideId
 * Delete all images for an override
 * Requires images:delete permission
 */
async function handleDELETE(request, { params }) {
  try {
    const { overrideId } = params

    if (!overrideId || !isValidId(overrideId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid overrideId' },
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
    console.error('[DELETE /api/images/[overrideId]] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete images' },
      { status: 500 }
    )
  }
}

// Apply authentication
export const GET = withAuth('images:read')(handleGET)
export const DELETE = withAuth('images:delete')(handleDELETE)

/**
 * GET /api/sync-queue/images
 *
 * Fetches approved, synced overrides with cloud images.
 * Returns grouped data per override with frame details for SN-based monitoring.
 *
 * Query params:
 *   - limit: max overrides to return (default 20)
 */

import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 20

    // Query approved, synced overrides with cloud images + frame details
    const url = `${POSTGREST_URL}/overrides?select=id,board_id,status,cloud_image_paths,ng_frame_details,reason,reviewed_at,sync_status&status=eq.approved&sync_status=eq.synced&cloud_image_paths=not.is.null&order=reviewed_at.desc.nullslast&limit=${limit}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] GET /api/sync-queue/images PostgREST error:', errorText)
      return NextResponse.json({ success: false, error: 'Failed to fetch from local database' }, { status: 500 })
    }

    const data = await response.json()
    const overrides = []
    let totalImages = 0

    for (const override of data || []) {
      // Parse cloud_image_paths
      let cloudPaths = null
      let imageCount = 0
      try {
        if (override.cloud_image_paths &&
            override.cloud_image_paths !== '{"top":[],"bottom":[]}' &&
            override.cloud_image_paths !== '{"top": [], "bottom": []}') {
          cloudPaths = typeof override.cloud_image_paths === 'string'
            ? JSON.parse(override.cloud_image_paths) : override.cloud_image_paths
          imageCount = (cloudPaths?.top?.length || 0) + (cloudPaths?.bottom?.length || 0)
        }
      } catch (e) {
        console.warn(`[API] Failed to parse cloud_image_paths for ${override.id}:`, e)
      }

      if (imageCount === 0) continue

      // Parse ng_frame_details (enriched with cloud URLs during sync)
      let frames = []
      try {
        if (override.ng_frame_details) {
          const parsed = typeof override.ng_frame_details === 'string'
            ? JSON.parse(override.ng_frame_details) : override.ng_frame_details
          if (Array.isArray(parsed)) frames = parsed
        }
      } catch (e) {
        console.warn(`[API] Failed to parse ng_frame_details for ${override.id}:`, e)
      }

      // Fallback: build basic frames from cloud_image_paths if no frame details
      if (frames.length === 0 && cloudPaths) {
        for (const side of ['top', 'bottom']) {
          if (cloudPaths[side]) {
            for (const img of cloudPaths[side]) {
              if (img.publicUrl) {
                frames.push({
                  side: side.toUpperCase(),
                  cloudAnnotatedUrl: img.publicUrl,
                  cloudRawUrl: img.rawPublicUrl || null
                })
              }
            }
          }
        }
      }

      // Unique serial numbers
      const snSet = new Set(frames.map(f => f.serialNumber).filter(Boolean))

      totalImages += imageCount

      overrides.push({
        overrideId: override.id,
        boardId: override.board_id,
        reason: override.reason,
        reviewedAt: override.reviewed_at,
        frames,
        imageCount,
        snCount: snSet.size || (frames.length > 0 ? 1 : 0),
        frameCount: frames.length
      })
    }

    console.log(`[API] GET /api/sync-queue/images: ${overrides.length} overrides, ${totalImages} total images`)

    return NextResponse.json({
      success: true,
      data: overrides,
      count: overrides.length,
      totalImages
    })

  } catch (error) {
    console.error('[API] GET /api/sync-queue/images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

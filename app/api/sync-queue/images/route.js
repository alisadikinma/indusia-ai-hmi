/**
 * GET /api/sync-queue/images
 * 
 * Fetches overrides with cloud_image_paths that have been synced
 * Query params: 
 *   - limit: number (default 20)
 */

import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 20

    // Query overrides that are approved and have cloud images with actual URLs
    const url = `${POSTGREST_URL}/overrides?select=id,board_id,status,cloud_image_paths,reviewed_at,sync_status&status=eq.approved&cloud_image_paths=not.is.null&order=reviewed_at.desc.nullslast&limit=${limit}`

    console.log(`[API] Querying: ${url}`)

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] GET /api/sync-queue/images PostgREST error:', errorText)
      return NextResponse.json({ success: false, error: 'Failed to fetch from local database' }, { status: 500 })
    }

    const data = await response.json()
    
    console.log(`[API] Raw data count: ${data?.length || 0}`)
    if (data?.length > 0) {
      console.log(`[API] First record cloud_image_paths:`, data[0].cloud_image_paths)
    }

    // Parse cloud_image_paths and flatten for display
    const images = []
    for (const override of data || []) {
      try {
        // Skip empty or default values
        if (!override.cloud_image_paths || 
            override.cloud_image_paths === '{"top":[],"bottom":[]}' ||
            override.cloud_image_paths === '{"top": [], "bottom": []}') {
          continue
        }

        const paths = typeof override.cloud_image_paths === 'string'
          ? JSON.parse(override.cloud_image_paths)
          : override.cloud_image_paths

        // Skip if parsed but still empty
        const hasTop = paths?.top && Array.isArray(paths.top) && paths.top.length > 0
        const hasBottom = paths?.bottom && Array.isArray(paths.bottom) && paths.bottom.length > 0
        
        if (!hasTop && !hasBottom) continue

        // Extract URLs from top images
        if (hasTop) {
          for (const img of paths.top) {
            if (img.publicUrl) {
              images.push({
                overrideId: override.id,
                boardId: override.board_id,
                side: 'top',
                url: img.publicUrl,
                cloudPath: img.cloudPath,
                reviewedAt: override.reviewed_at
              })
            }
          }
        }

        // Extract URLs from bottom images
        if (hasBottom) {
          for (const img of paths.bottom) {
            if (img.publicUrl) {
              images.push({
                overrideId: override.id,
                boardId: override.board_id,
                side: 'bottom',
                url: img.publicUrl,
                cloudPath: img.cloudPath,
                reviewedAt: override.reviewed_at
              })
            }
          }
        }
      } catch (parseErr) {
        console.warn(`[API] Failed to parse cloud_image_paths for ${override.id}:`, parseErr)
      }
    }

    console.log(`[API] GET /api/sync-queue/images: Found ${images.length} uploaded images`)

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length
    })

  } catch (error) {
    console.error('[API] GET /api/sync-queue/images error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

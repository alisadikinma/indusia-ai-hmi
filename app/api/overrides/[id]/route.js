import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo'
import { withAuth } from '@/lib/auth/apiAuth'
import { uploadOverrideImages, isCloudSyncConfigured } from '@/lib/sync'

/**
 * GET /api/overrides/:id
 */
async function handleGET(request, { params }) {
  try {
    const { id } = params
    const result = await overridesRepo.getById(id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/overrides/:id
 * Body: { action: 'approve'|'reject', reviewerId, reviewerName, reviewNotes }
 * 
 * Flow when APPROVED:
 * 1. Update override status → 'approved'
 * 2. Upload images to Supabase Storage (if cloud configured)
 * 3. Add to sync_queue for cloud upload
 */
async function handlePATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    if (!body.reviewerId || !body.reviewerName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: reviewerId, reviewerName' },
        { status: 400 }
      )
    }

    let result
    let imageUploadResult = null
    
    if (body.action === 'approve') {
      result = await overridesRepo.approve(
        id,
        body.reviewerId,
        body.reviewerName,
        body.reviewNotes || ''
      )
      
      // Upload images to Supabase Storage (if cloud configured)
      if (result.data && isCloudSyncConfigured()) {
        try {
          const localPaths = result.data.localImagePaths || result.data.local_image_paths
          if (localPaths) {
            imageUploadResult = await uploadOverrideImages(id, localPaths)
            
            if (imageUploadResult.success && imageUploadResult.cloudPaths) {
              // Update override with cloud paths
              await overridesRepo.updateCloudPaths(id, JSON.stringify(imageUploadResult.cloudPaths))
              console.log('[PATCH /api/overrides] Images uploaded to cloud:', id, imageUploadResult.uploadCount)
            }
          }
        } catch (uploadError) {
          console.warn('[PATCH /api/overrides] Cloud image upload failed:', uploadError)
          // Don't fail the approval - images will sync later
        }
      }
      
      // Add to sync_queue for cloud upload (after approval)
      if (result.data) {
        try {
          // Parse local_image_paths if available
          let imagePaths = []
          if (result.data.localImagePaths) {
            try {
              const parsed = JSON.parse(result.data.localImagePaths)
              if (parsed.top) imagePaths.push(...parsed.top.map(p => ({ ...p, side: 'TOP' })))
              if (parsed.bottom) imagePaths.push(...parsed.bottom.map(p => ({ ...p, side: 'BOTTOM' })))
            } catch (e) {
              console.warn('[PATCH /api/overrides] Failed to parse localImagePaths:', e)
            }
          }
          
          // Fallback to single path
          if (imagePaths.length === 0 && result.data.localImagePath) {
            imagePaths.push({ path: result.data.localImagePath, side: 'TOP' })
          }
          
          // Add each image to sync queue
          for (const img of imagePaths) {
            await syncQueueRepo.addToQueue({
              inspectionId: null,
              boardId: result.data.boardId,
              customerName: result.data.customerName || 'Unknown',
              sectionName: result.data.sectionName || 'Unknown',
              lineName: result.data.lineName || 'Unknown',
              defectType: result.data.overrideType || result.data.defectType || 'false_call',
              localImagePath: img.path,
              recordType: 'override',
              overrideId: id,
            })
          }
          
          console.log('[PATCH /api/overrides] Added to sync queue:', id, imagePaths.length, 'images')
        } catch (syncError) {
          console.warn('[PATCH /api/overrides] Sync queue add failed:', syncError)
          // Don't fail the approval
        }
      }
    } else {
      result = await overridesRepo.reject(
        id,
        body.reviewerId,
        body.reviewerName,
        body.reviewNotes || ''
      )
    }

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      imageUpload: imageUploadResult 
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const GET = withAuth('overrides:read')(handleGET)
export const PATCH = withAuth('overrides:review')(handlePATCH)

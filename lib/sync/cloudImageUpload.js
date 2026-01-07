/**
 * Cloud Image Upload Service
 * 
 * Uploads local override images to Supabase Storage
 * Called when Manager approves an override
 */

import { supabaseAdmin, isCloudSyncConfigured } from '@/lib/sync/supabaseAdmin'
import fs from 'fs'
import path from 'path'

const STORAGE_BUCKET = 'override-images'

/**
 * Upload override images to Supabase Storage
 * @param {string} overrideId - Override ID
 * @param {string} localImagePaths - JSON string of local paths
 * @returns {Promise<{success: boolean, cloudPaths?: object, error?: string}>}
 */
export async function uploadOverrideImages(overrideId, localImagePaths) {
  if (!isCloudSyncConfigured() || !supabaseAdmin) {
    console.log('[CloudImageUpload] Cloud not configured, skipping')
    return { success: false, error: 'Cloud not configured' }
  }

  if (!localImagePaths) {
    return { success: true, cloudPaths: {} }
  }

  try {
    // Parse local paths JSON
    const paths = typeof localImagePaths === 'string' 
      ? JSON.parse(localImagePaths) 
      : localImagePaths

    const cloudPaths = { top: [], bottom: [] }
    let uploadCount = 0

    // Process TOP images
    if (paths.top && Array.isArray(paths.top)) {
      for (const img of paths.top) {
        const result = await uploadSingleImage(img.path, overrideId, 'top')
        if (result.success) {
          cloudPaths.top.push({
            localPath: img.path,
            cloudPath: result.cloudPath,
            publicUrl: result.publicUrl
          })
          uploadCount++
        }
      }
    }

    // Process BOTTOM images
    if (paths.bottom && Array.isArray(paths.bottom)) {
      for (const img of paths.bottom) {
        const result = await uploadSingleImage(img.path, overrideId, 'bottom')
        if (result.success) {
          cloudPaths.bottom.push({
            localPath: img.path,
            cloudPath: result.cloudPath,
            publicUrl: result.publicUrl
          })
          uploadCount++
        }
      }
    }

    console.log(`[CloudImageUpload] Uploaded ${uploadCount} images for override ${overrideId}`)

    return { 
      success: true, 
      cloudPaths,
      uploadCount
    }

  } catch (error) {
    console.error('[CloudImageUpload] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Upload single image file
 */
async function uploadSingleImage(localPath, overrideId, side) {
  try {
    // Check if file exists
    if (!fs.existsSync(localPath)) {
      console.warn(`[CloudImageUpload] File not found: ${localPath}`)
      return { success: false, error: 'File not found' }
    }

    // Read file
    const fileBuffer = fs.readFileSync(localPath)
    const fileName = path.basename(localPath)
    
    // Create cloud path: override-images/{overrideId}/{side}/{filename}
    const cloudPath = `${overrideId}/${side}/${fileName}`

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(cloudPath, fileBuffer, {
        contentType: getContentType(fileName),
        upsert: true
      })

    if (error) {
      console.error(`[CloudImageUpload] Upload error for ${cloudPath}:`, error)
      return { success: false, error: error.message }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(cloudPath)

    return {
      success: true,
      cloudPath: data.path,
      publicUrl: urlData?.publicUrl
    }

  } catch (error) {
    console.error('[CloudImageUpload] Single upload error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get content type from filename
 */
function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  }
  return types[ext] || 'image/jpeg'
}

/**
 * Ensure storage bucket exists
 * Should be called once at startup or before first upload
 */
export async function ensureStorageBucket() {
  if (!isCloudSyncConfigured() || !supabaseAdmin) {
    return { success: false, error: 'Cloud not configured' }
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.error('[CloudImageUpload] List buckets error:', listError)
      return { success: false, error: listError.message }
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET)

    if (!bucketExists) {
      // Create bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
        public: true, // Public read for AI training access
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      })

      if (createError) {
        console.error('[CloudImageUpload] Create bucket error:', createError)
        return { success: false, error: createError.message }
      }

      console.log(`[CloudImageUpload] Created bucket: ${STORAGE_BUCKET}`)
    }

    return { success: true }

  } catch (error) {
    console.error('[CloudImageUpload] Ensure bucket error:', error)
    return { success: false, error: error.message }
  }
}

export default {
  uploadOverrideImages,
  ensureStorageBucket
}

/**
 * Cloud Image Upload Service
 * 
 * Uploads local override images to Supabase Storage
 * Called when Manager approves an override
 */

import { supabaseAdmin, isCloudSyncConfigured } from '@/lib/sync/supabaseAdmin'
import fs from 'fs'
import path from 'path'

const STORAGE_BUCKET = 'inspection-images'

// Base path for local false call images
// In production, this should be configured via environment variable
const LOCAL_STORAGE_BASE = process.env.LOCAL_STORAGE_PATH || 
  path.join(process.cwd(), 'storage', 'false-calls')

/**
 * Upload override images to Supabase Storage
 * @param {string} overrideId - Override ID
 * @param {string} localImagePaths - JSON string of local paths
 * @param {Object} pathToSnMap - Map of local image path → serial number (from ng_frame_details)
 * @returns {Promise<{success: boolean, cloudPaths?: object, error?: string}>}
 */
export async function uploadOverrideImages(overrideId, localImagePaths, pathToSnMap = {}) {
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

    // Process TOP images (annotated + raw)
    if (paths.top && Array.isArray(paths.top)) {
      for (const img of paths.top) {
        const entry = { localPath: img.path, frameIndex: img.frameIndex }
        const sn = pathToSnMap[img.path] || null

        // Upload annotated image
        const result = await uploadSingleImage(img.path, overrideId, 'top', sn)
        if (result.success) {
          entry.cloudPath = result.cloudPath
          entry.publicUrl = result.publicUrl
          uploadCount++
        }

        // Upload raw image if present
        if (img.rawPath) {
          const rawSn = pathToSnMap[img.rawPath] || sn
          const rawResult = await uploadSingleImage(img.rawPath, overrideId, 'top', rawSn)
          if (rawResult.success) {
            entry.rawLocalPath = img.rawPath
            entry.rawCloudPath = rawResult.cloudPath
            entry.rawPublicUrl = rawResult.publicUrl
            uploadCount++
          }
        }

        cloudPaths.top.push(entry)
      }
    }

    // Process BOTTOM images (annotated + raw)
    if (paths.bottom && Array.isArray(paths.bottom)) {
      for (const img of paths.bottom) {
        const entry = { localPath: img.path, frameIndex: img.frameIndex }
        const sn = pathToSnMap[img.path] || null

        // Upload annotated image
        const result = await uploadSingleImage(img.path, overrideId, 'bottom', sn)
        if (result.success) {
          entry.cloudPath = result.cloudPath
          entry.publicUrl = result.publicUrl
          uploadCount++
        }

        // Upload raw image if present
        if (img.rawPath) {
          const rawSn = pathToSnMap[img.rawPath] || sn
          const rawResult = await uploadSingleImage(img.rawPath, overrideId, 'bottom', rawSn)
          if (rawResult.success) {
            entry.rawLocalPath = img.rawPath
            entry.rawCloudPath = rawResult.cloudPath
            entry.rawPublicUrl = rawResult.publicUrl
            uploadCount++
          }
        }

        cloudPaths.bottom.push(entry)
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
 * @param {string} relativePath - Relative path from database (e.g., "2026/01/07/WO-.../file.png")
 * @param {string} overrideId - Override ID for reference
 * @param {string} side - "top" or "bottom"
 * @param {string|null} serialNumber - Serial number for subfolder grouping (e.g., "SN-000317")
 */
async function uploadSingleImage(relativePath, overrideId, side, serialNumber) {
  try {
    // Convert relative path to absolute path
    // Database stores: "2026/01/07/WO-.../file.png"
    // Need to join with LOCAL_STORAGE_BASE
    const localPath = path.join(LOCAL_STORAGE_BASE, relativePath)

    console.log(`[CloudImageUpload] Checking file: ${localPath}`)

    // Check if file exists
    if (!fs.existsSync(localPath)) {
      console.warn(`[CloudImageUpload] File not found: ${localPath}`)
      return { success: false, error: `File not found: ${localPath}` }
    }

    // Read file
    const fileBuffer = fs.readFileSync(localPath)
    const fileName = path.basename(localPath)

    // Extract year/month from relative path (e.g., 2026/01/07/WO-xxx/file.png)
    const pathParts = relativePath.split(/[\\/]/)
    const year = pathParts[0] || new Date().getFullYear().toString()
    const month = pathParts[1] || (new Date().getMonth() + 1).toString().padStart(2, '0')
    const woFolder = pathParts[3] || 'unknown' // WO-20260105-0001

    // Create cloud path: {year}/{month}/{work_order}/{serial_number}/{filename}
    // Example: 2026/02/WO-20260105-0001/SN-000317/20260209_134133_BOTTOM_F3_xxx.png
    // Falls back to flat WO structure if no serial number available
    const cloudPath = serialNumber
      ? `${year}/${month}/${woFolder}/${serialNumber}/${fileName}`
      : `${year}/${month}/${woFolder}/${fileName}`

    console.log(`[CloudImageUpload] Uploading to: ${cloudPath}`)

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

    console.log(`[CloudImageUpload] Upload success: ${urlData?.publicUrl}`)

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

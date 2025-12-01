/**
 * Image Storage Repository
 * Handles image upload to Supabase Storage and database tracking
 */

import { supabase } from '@/lib/supabaseClient'

const BUCKET_NAME = 'inspection-images'

/**
 * Upload a single image to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path
 * @returns {Promise<{storagePath: string, publicUrl: string}>}
 */
export async function uploadImage(file, path) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error('[imageStorageRepo.uploadImage]', error)
    throw error
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  return {
    storagePath: data.path,
    publicUrl: urlData.publicUrl
  }
}

/**
 * Upload multiple images for an override
 * @param {File[]} files - Array of files to upload
 * @param {string} overrideId - Override ID
 * @param {string} sectionId - Section ID for path
 * @param {string} boardId - Board ID for path
 * @param {string} userId - User ID who uploaded
 * @returns {Promise<Array>} Array of created image records
 */
export async function uploadOverrideImages(files, overrideId, sectionId, boardId, userId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const results = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop() || 'jpg'
    const safeSectionId = (sectionId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '')
    const safeBoardId = (boardId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '')
    const path = `false-call-overrides/${safeSectionId}/${safeBoardId}/${timestamp}-${i}.${ext}`

    try {
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

      if (error) {
        console.error('[imageStorageRepo.uploadOverrideImages] DB insert error:', error)
        // Continue with other files even if one fails
        continue
      }

      results.push(data)
    } catch (err) {
      console.error(`[imageStorageRepo.uploadOverrideImages] Failed to upload file ${i}:`, err)
      // Continue with other files
    }
  }

  return results
}

/**
 * Get all images for an override
 * @param {string} overrideId - Override ID
 * @returns {Promise<Array>}
 */
export async function getImagesByOverride(overrideId) {
  const { data, error } = await supabase
    .from('override_images')
    .select('*')
    .eq('override_id', overrideId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[imageStorageRepo.getImagesByOverride]', error)
    return []
  }

  return data || []
}

/**
 * Delete an image by ID
 * @param {string} imageId - Image record ID
 * @returns {Promise<boolean>}
 */
export async function deleteImage(imageId) {
  try {
    // Get image record first
    const { data: image, error: fetchError } = await supabase
      .from('override_images')
      .select('storage_path')
      .eq('id', imageId)
      .single()

    if (fetchError || !image) {
      console.error('[imageStorageRepo.deleteImage] Image not found:', fetchError)
      return false
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([image.storage_path])

    if (storageError) {
      console.error('[imageStorageRepo.deleteImage] Storage delete error:', storageError)
      // Continue to delete DB record even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('override_images')
      .delete()
      .eq('id', imageId)

    if (dbError) {
      console.error('[imageStorageRepo.deleteImage] DB delete error:', dbError)
      return false
    }

    return true
  } catch (err) {
    console.error('[imageStorageRepo.deleteImage] Error:', err)
    return false
  }
}

/**
 * Delete all images for an override
 * @param {string} overrideId - Override ID
 * @returns {Promise<boolean>}
 */
export async function deleteImagesByOverride(overrideId) {
  try {
    // Get all image records
    const images = await getImagesByOverride(overrideId)

    if (images.length === 0) return true

    // Delete from storage
    const paths = images.map(img => img.storage_path).filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(paths)
    }

    // Delete from database
    const { error } = await supabase
      .from('override_images')
      .delete()
      .eq('override_id', overrideId)

    if (error) {
      console.error('[imageStorageRepo.deleteImagesByOverride]', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[imageStorageRepo.deleteImagesByOverride] Error:', err)
    return false
  }
}

export default {
  uploadImage,
  uploadOverrideImages,
  getImagesByOverride,
  deleteImage,
  deleteImagesByOverride
}

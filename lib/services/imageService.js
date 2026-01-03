/**
 * Image Service
 * Handles image operations with Supabase Storage
 * 
 * ARCHITECTURE:
 * - Hardcoded bbox mapping per sample image
 * - Each image has predefined defect locations
 * - Supports multiple defects per board
 */

import { supabase } from '@/lib/supabaseClient';

const BUCKET_NAME = 'inspection-images';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

/**
 * Get public URL for an image in storage
 */
export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  
  if (SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
  }
  
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Get signed URL for private images
 */
export async function getSignedUrl(path, expiresIn = 3600) {
  if (!path) return null;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error('[ImageService] Signed URL error:', error);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Upload inspection image
 */
export async function uploadImage(file, path, options = {}) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: options.upsert || false,
        contentType: file.type || 'image/png',
      });
    
    if (error) throw error;
    return { success: true, path: data.path };
  } catch (error) {
    console.error('[ImageService] Upload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate storage path for inspection image
 */
export function generateInspectionPath({ lineId, boardId, type = 'overview', timestamp }) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const ts = now.getTime();
  
  return `inspections/${year}/${month}/${day}/${lineId}/${type}_${boardId}_${ts}.png`;
}

// =============================================================================
// HARDCODED DEFECT DATA PER IMAGE
// IPC-A-610 References:
//   8.2.5 - Insufficient Solder
//   8.2.6 - Excess Solder  
//   8.2.7 - Cold/Disturbed Solder
//   8.2.8 - Solder Balls
//   8.2.9 - Solder Bridges
//   8.3.1 - Missing Component
//   8.3.4 - Tombstone (Drawbridge)
//   8.3.6 - Misalignment
// =============================================================================

const IMAGE_DEFECT_MAP = {
  'pcb_missing_component_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'missing_component',
        confidence: 0.98,
        severity: 'critical',
        component_ref: 'C23',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.3.1',
        bbox: { x: 894, y: 472, width: 638, height: 722 },
        reviewed: false,
      },
    ],
  },
  
  'pcb_solder_bridge_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'solder_bridge',
        confidence: 0.94,
        severity: 'critical',
        component_ref: 'U15',
        pin_number: 'Pin 3-4',
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 1416, y: 610, width: 484, height: 460 },
        reviewed: false,
      },
    ],
  },
  
  'pcb_tombstone_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'tombstone',
        confidence: 0.96,
        severity: 'critical',
        component_ref: 'R12',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.3.4',
        bbox: { x: 778, y: 624, width: 900, height: 497 },
        reviewed: false,
      },
    ],
  },
  
  'pcb_insufficient_solder_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'insufficient_solder',
        confidence: 0.88,
        severity: 'major',
        component_ref: 'R47',
        pin_number: 'Left Pad',
        ipc_reference: 'IPC-A-610 8.2.5',
        bbox: { x: 809, y: 851, width: 821, height: 402 },
        reviewed: false,
      },
    ],
  },
  
  'pcb_cold_solder_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'cold_solder',
        confidence: 0.91,
        severity: 'major',
        component_ref: 'U8',
        pin_number: 'Bottom-Left Pins',
        ipc_reference: 'IPC-A-610 8.2.7',
        bbox: { x: 560, y: 680, width: 380, height: 420 },
        reviewed: false,
      },
    ],
  },
  
  'pcb_solder_ball_01.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    defects: [
      {
        id: 1,
        class_name: 'solder_ball',
        confidence: 0.89,
        severity: 'minor',
        component_ref: 'PCB Surface',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.8',
        bbox: { x: 1149, y: 969, width: 804, height: 601 },
        reviewed: false,
      },
    ],
  },
};

// List of available sample images
const SAMPLE_IMAGES = Object.keys(IMAGE_DEFECT_MAP);

/**
 * Get inspection result with hardcoded defects for specific image
 */
export async function getInspectionResult() {
  // Pick random image from available samples
  const filename = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
  
  // Get hardcoded data for this image
  const imageData = IMAGE_DEFECT_MAP[filename];
  
  // Build image URL - use local path since images are in public folder
  const imageUrl = `/images/${filename}`;
  
  // Clone defects to avoid mutating original data
  const defects = imageData.defects.map(d => ({ ...d, reviewed: false }));
  
  console.log('[ImageService] Inspection result:', {
    image: filename,
    defectCount: defects.length,
    defects: defects.map(d => `${d.class_name}@${d.component_ref}`),
  });
  
  return {
    imageUrl,
    imagePath: filename,
    imageWidth: imageData.imageWidth,
    imageHeight: imageData.imageHeight,
    defects,
    timestamp: new Date().toISOString(),
    source: 'hardcoded',
  };
}

/**
 * @deprecated Use getInspectionResult() instead
 */
export async function getRandomSampleDefect() {
  const result = await getInspectionResult();
  return {
    id: null,
    imagePath: result.imagePath,
    imageUrl: result.imageUrl,
    defect: result.defects[0] || null,
    defects: result.defects,
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
  };
}

/**
 * List sample images from DB
 */
export async function listSampleImages(filters = {}) {
  try {
    let query = supabase
      .from('sample_images')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (filters.hasDefect !== undefined) query = query.eq('has_defect', filters.hasDefect);
    if (filters.defectType) query = query.eq('defect_type', filters.defectType);
    if (filters.boardType) query = query.eq('board_type', filters.boardType);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ImageService] List samples error:', error);
    return [];
  }
}

export function getAvailableSamples() {
  return SAMPLE_IMAGES;
}

export function getImageDefects(filename) {
  return IMAGE_DEFECT_MAP[filename] || null;
}

export const imageService = {
  getUrl: getImageUrl,
  getSignedUrl,
  upload: uploadImage,
  generatePath: generateInspectionPath,
  getInspectionResult,
  getRandomSampleDefect,
  listSamples: listSampleImages,
  getAvailableSamples,
  getImageDefects,
};

export default imageService;

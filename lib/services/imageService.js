/**
 * Image Service
 * Handles image operations with Supabase Storage
 * 
 * ARCHITECTURE:
 * - Hardcoded bbox mapping per sample image
 * - Each image has predefined defect locations
 * - Supports multiple defects per board
 * - Supports TOP/BOTTOM side images
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
// PCB COMPONENT LOCATIONS (based on golden sample)
// Coordinates are approximate for 1024x768 image size
// =============================================================================
const COMPONENT_LOCATIONS = {
  // Resistors (left side, vertical stack)
  R1: { x: 80, y: 145, width: 65, height: 35 },
  R2: { x: 80, y: 220, width: 65, height: 35 },
  R3: { x: 80, y: 295, width: 65, height: 35 },
  R4: { x: 80, y: 370, width: 65, height: 35 },
  
  // Capacitors near U1 (top)
  C1: { x: 355, y: 115, width: 55, height: 40 },
  C2: { x: 445, y: 115, width: 55, height: 40 },
  
  // Capacitors right of U1
  C3: { x: 595, y: 200, width: 55, height: 40 },
  C4: { x: 595, y: 355, width: 55, height: 40 },
  
  // U1 - QFP-48 center IC
  U1: { x: 320, y: 195, width: 200, height: 200 },
  U1_LEFT_PINS: { x: 320, y: 230, width: 30, height: 130 },
  U1_RIGHT_PINS: { x: 490, y: 230, width: 30, height: 130 },
  U1_TOP_PINS: { x: 355, y: 195, width: 130, height: 30 },
  U1_BOTTOM_PINS: { x: 355, y: 365, width: 130, height: 30 },
  
  // U2 - SOIC-8 (upper right)
  U2: { x: 750, y: 140, width: 90, height: 70 },
  U2_PINS: { x: 750, y: 140, width: 90, height: 70 },
  
  // C5 - Electrolytic (lower right)
  C5: { x: 780, y: 490, width: 75, height: 85 },
  
  // J1 - 2x5 Header (bottom center)
  J1: { x: 320, y: 555, width: 180, height: 55 },
  J1_PINS: { x: 340, y: 560, width: 140, height: 45 },
};

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
  // ==================== GOOD REFERENCES ====================
  'pcb_golden_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [], // No defects - good reference
  },
  
  'pcb_golden_BOTTOM.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'BOTTOM',
    defects: [], // No defects - good reference
  },

  // ==================== SINGLE DEFECT - TOP ====================
  
  // Missing Component - R2
  'pcb_MC_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'missing_component',
        confidence: 0.94,
        severity: 'critical',
        component_ref: 'R2',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 314, y: 708, width: 257, height: 169 },
        reviewed: false,
      },
    ],
  },
  
  // Solder Bridge - U1 pins 8-9
  'pcb_SB_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'solder_ball',
        confidence: 0.94,
        severity: 'major',
        component_ref: 'U1',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 814, y: 746, width: 217, height: 206 },
        reviewed: false,
      },
    ],
  },
  
    // pcb_TS_01_TOP.png
  'pcb_TS_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'tombstone',
        confidence: 0.94,
        severity: 'major',
        component_ref: 'C3',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 1287, y: 482, width: 199, height: 217 },
        reviewed: false,
      },
    ],
  },
  
  // Missing Component - R4 left pad
  'pcb_IS_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'missing_component',
        confidence: 0.94,
        severity: 'critical',
        component_ref: 'R4',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 314, y: 1048, width: 289, height: 146 },
        reviewed: false,
      },
    ],
  },

  // ==================== SINGLE DEFECT - BOTTOM ====================
  
  // Cold Solder - J1 pin
  // pcb_CS_01_BOTTOM.png
  'pcb_CS_01_BOTTOM.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'BOTTOM',
    defects: [
      {
        id: 1,
        class_name: 'cold_solder',
        confidence: 0.94,
        severity: 'minor',
        component_ref: 'J1',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 997, y: 1439, width: 172, height: 159 },
        reviewed: false,
      },
    ],
  },
  
  // Solder Balls - near J1
  // pcb_SL_01_BOTTOM.png
  'pcb_SL_01_BOTTOM.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'BOTTOM',
    defects: [
      {
        id: 1,
        class_name: 'solder_ball',
        confidence: 0.94,
        severity: 'minor',
        component_ref: 'PCB Surface',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 775, y: 1598, width: 146, height: 159 },
        reviewed: false,
      },
    ],
  },

  // ==================== DOUBLE DEFECT - TOP ====================
  
  // Missing C1 + Solder Bridge U1
    // pcb_MC-SB_01_TOP.png
  'pcb_MC-SB_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'missing_component',
        confidence: 0.94,
        severity: 'critical',
        component_ref: 'C1',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 954, y: 373, width: 245, height: 142 },
        reviewed: false,
      },
      {
        id: 2,
        class_name: 'solder_bridge',
        confidence: 0.94,
        severity: 'critical',
        component_ref: 'U1',
        pin_number: 'PIN 12-13',
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 1199, y: 600, width: 209, height: 90 },
        reviewed: false,
      },
    ],
  },

  // ==================== TRIPLE DEFECT - TOP ====================
  
  // Insufficient R2 + Cold Solder U2 + Solder Balls near C5
   // pcb_IS-CS-SL_01_TOP.png
  'pcb_IS-CS-SL_01_TOP.png': {
    imageWidth: 2400,
    imageHeight: 1792,
    side: 'TOP',
    defects: [
      {
        id: 1,
        class_name: 'insufficient_solder',
        confidence: 0.94,
        severity: 'minor',
        component_ref: 'R2',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 347, y: 710, width: 222, height: 153 },
        reviewed: false,
      },
      {
        id: 2,
        class_name: 'cold_solder',
        confidence: 0.94,
        severity: 'minor',
        component_ref: 'U2',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 1700, y: 187, width: 146, height: 119 },
        reviewed: false,
      },
      {
        id: 3,
        class_name: 'solder_ball',
        confidence: 0.94,
        severity: 'minor',
        component_ref: 'PCB Surface',
        pin_number: null,
        ipc_reference: 'IPC-A-610 8.2.9',
        bbox: { x: 1799, y: 1310, width: 133, height: 89 },
        reviewed: false,
      },
    ],
  },
};

// ==================== IMAGE LISTS BY SIDE ====================

const TOP_IMAGES = Object.entries(IMAGE_DEFECT_MAP)
  .filter(([_, data]) => data.side === 'TOP' && data.defects.length > 0)
  .map(([filename]) => filename);

const BOTTOM_IMAGES = Object.entries(IMAGE_DEFECT_MAP)
  .filter(([_, data]) => data.side === 'BOTTOM' && data.defects.length > 0)
  .map(([filename]) => filename);

const GOOD_TOP_IMAGES = ['pcb_golden_TOP.png'];
const GOOD_BOTTOM_IMAGES = ['pcb_golden_BOTTOM.png'];

// All sample images
const SAMPLE_IMAGES = Object.keys(IMAGE_DEFECT_MAP);

/**
 * Get inspection result for simulation
 * @param {Object} options - Options
 * @param {string} options.side - 'TOP' or 'BOTTOM'
 * @param {string} options.result - 'GOOD' or 'NG' (optional, random if not specified)
 */
export async function getInspectionResult(options = {}) {
  const { side = 'TOP', result } = options;
  
  console.log('[ImageService] getInspectionResult called:', { side, result });
  console.log('[ImageService] Available images:', { 
    TOP_NG: TOP_IMAGES, 
    BOTTOM_NG: BOTTOM_IMAGES,
    TOP_GOOD: GOOD_TOP_IMAGES,
    BOTTOM_GOOD: GOOD_BOTTOM_IMAGES
  });
  
  let filename;
  
  if (result === 'GOOD') {
    // Return good reference for specified side
    filename = side === 'BOTTOM' ? GOOD_BOTTOM_IMAGES[0] : GOOD_TOP_IMAGES[0];
    console.log('[ImageService] GOOD result, selected:', filename);
  } else if (result === 'NG') {
    // Pick random NG image for specified side
    const ngImages = side === 'BOTTOM' ? BOTTOM_IMAGES : TOP_IMAGES;
    const randomIndex = Math.floor(Math.random() * ngImages.length);
    filename = ngImages[randomIndex];
    console.log('[ImageService] NG result, available:', ngImages.length, 'selected index:', randomIndex, 'file:', filename);
  } else {
    // Random: pick from all images for specified side (including good)
    const allSideImages = side === 'BOTTOM' 
      ? [...BOTTOM_IMAGES, ...GOOD_BOTTOM_IMAGES]
      : [...TOP_IMAGES, ...GOOD_TOP_IMAGES];
    filename = allSideImages[Math.floor(Math.random() * allSideImages.length)];
  }
  
  // Fallback if no images for side
  if (!filename) {
    filename = TOP_IMAGES[0] || 'pcb_golden_TOP.png';
  }
  
  const imageData = IMAGE_DEFECT_MAP[filename];
  
  if (!imageData) {
    console.error('[ImageService] No data for image:', filename);
    return null;
  }
  
  // Build image URL
  const imageUrl = `/images/${filename}`;
  
  // Clone defects to avoid mutating original data
  const defects = imageData.defects.map(d => ({ ...d, reviewed: false }));
  
  console.log('[ImageService] Inspection result:', {
    image: filename,
    side: imageData.side,
    defectCount: defects.length,
    defects: defects.map(d => `${d.class_name}@${d.component_ref}`),
  });
  
  return {
    imageUrl,
    imagePath: filename,
    imageWidth: imageData.imageWidth,
    imageHeight: imageData.imageHeight,
    side: imageData.side,
    defects,
    isGood: defects.length === 0,
    timestamp: new Date().toISOString(),
    source: 'hardcoded',
  };
}

/**
 * Get good reference image for specified side
 */
export function getGoodReferenceImage(side = 'TOP') {
  const filename = side === 'BOTTOM' ? 'pcb_golden_BOTTOM.png' : 'pcb_golden_TOP.png';
  return {
    imageUrl: `/images/${filename}`,
    imagePath: filename,
    imageWidth: 1024,
    imageHeight: 768,
    side,
  };
}

/**
 * @deprecated Use getInspectionResult() instead
 */
export async function getRandomSampleDefect() {
  const result = await getInspectionResult({ result: 'NG' });
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

export function getAvailableBySide(side) {
  return side === 'BOTTOM' 
    ? { ng: BOTTOM_IMAGES, good: GOOD_BOTTOM_IMAGES }
    : { ng: TOP_IMAGES, good: GOOD_TOP_IMAGES };
}

export const imageService = {
  getUrl: getImageUrl,
  getSignedUrl,
  upload: uploadImage,
  generatePath: generateInspectionPath,
  getInspectionResult,
  getGoodReferenceImage,
  getRandomSampleDefect,
  listSamples: listSampleImages,
  getAvailableSamples,
  getImageDefects,
  getAvailableBySide,
};

export default imageService;

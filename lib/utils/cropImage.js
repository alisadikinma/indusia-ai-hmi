/**
 * Crop Image Utility
 * Crops an image around a bounding box with padding
 */

/**
 * Crop image around defect bbox
 * @param {string} imageSrc - Image URL
 * @param {object} bbox - Bounding box {x, y, width, height}
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @param {number} padding - Padding percentage (0.3 = 30%)
 * @returns {Promise<string>} - Base64 encoded cropped image
 */
export async function cropDefectImage(imageSrc, bbox, imageWidth, imageHeight, padding = 0.3) {
  return new Promise((resolve, reject) => {
    if (!imageSrc || !bbox) {
      reject(new Error('Missing imageSrc or bbox'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Add padding around defect
        const paddingX = Math.max(bbox.width * padding, 50);
        const paddingY = Math.max(bbox.height * padding, 50);

        // Calculate crop area with padding
        let cropX = Math.max(0, bbox.x - paddingX);
        let cropY = Math.max(0, bbox.y - paddingY);
        let cropW = bbox.width + paddingX * 2;
        let cropH = bbox.height + paddingY * 2;

        // Ensure crop doesn't exceed image bounds
        if (cropX + cropW > img.naturalWidth) {
          cropW = img.naturalWidth - cropX;
        }
        if (cropY + cropH > img.naturalHeight) {
          cropH = img.naturalHeight - cropY;
        }

        // Set canvas size (max 800px for good quality)
        const maxSize = 800;
        const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
        canvas.width = cropW * scale;
        canvas.height = cropH * scale;

        // Draw cropped area
        ctx.drawImage(
          img,
          cropX, cropY, cropW, cropH,  // source
          0, 0, canvas.width, canvas.height  // destination
        );

        // Draw bbox indicator on cropped image
        const bboxX = (bbox.x - cropX) * scale;
        const bboxY = (bbox.y - cropY) * scale;
        const bboxW = bbox.width * scale;
        const bboxH = bbox.height * scale;

        ctx.strokeStyle = '#EF4444'; // Red border
        ctx.lineWidth = 3;
        ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);

        // Convert to base64
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageSrc;
  });
}

/**
 * Save cropped defect image to server
 * @param {object} params - Save parameters
 * @returns {Promise<object>} - Save result with file path
 */
export async function saveCroppedImage({
  imageData,
  boardId,
  defectIndex,
  defectType,
  side,
  woNumber,
}) {
  try {
    const response = await fetch('/api/inspection/save-crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData,
        boardId,
        defectIndex,
        defectType,
        side,
        woNumber,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save cropped image');
    }

    return result.data;
  } catch (error) {
    console.error('[SaveCrop] Error:', error);
    throw error;
  }
}

/**
 * Crop and save all defects for a board
 * @param {object} params - Parameters
 * @returns {Promise<Array>} - Array of saved file paths
 */
export async function cropAndSaveAllDefects({
  imageSrc,
  defects,
  imageWidth,
  imageHeight,
  boardId,
  side,
  woNumber,
}) {
  const savedFiles = [];

  for (let i = 0; i < defects.length; i++) {
    const defect = defects[i];
    
    if (!defect.bbox) {
      console.warn(`[CropAndSave] Defect ${i} has no bbox, skipping`);
      continue;
    }

    try {
      // Crop the image
      const croppedImage = await cropDefectImage(
        imageSrc,
        defect.bbox,
        imageWidth,
        imageHeight
      );

      // Save to server
      const saved = await saveCroppedImage({
        imageData: croppedImage,
        boardId,
        defectIndex: i,
        defectType: defect.class_name,
        side,
        woNumber,
      });

      savedFiles.push({
        defectIndex: i,
        defectType: defect.class_name,
        filePath: saved.filePath,
      });

      console.log(`[CropAndSave] Saved defect ${i}:`, saved.filePath);
    } catch (error) {
      console.error(`[CropAndSave] Failed to save defect ${i}:`, error);
    }
  }

  return savedFiles;
}

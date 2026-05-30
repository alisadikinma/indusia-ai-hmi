/**
 * Image Naming Utility
 * Generates standardized filenames for inspection images
 * 
 * Format: {YYYYMMDD}_{HHmmss}_{SIDE}_{RESULT}_{MODEL}_{CUSTOMER}_{TYPE}[_{DEFECT}].png
 * 
 * Examples:
 * - 20260103_143052_TOP_GOOD_v1.2.3_ACME_full.png
 * - 20260103_143205_TOP_NG_v1.2.3_ACME_crop_solder_bridge.png
 * - 20260103_143312_BOT_FC_v1.2.3_ACME_full.png
 */

/**
 * Generate inspection image filename
 * @param {Object} params
 * @param {string} params.side - 'TOP' | 'BOTTOM'
 * @param {string} params.result - 'GOOD' | 'NG' | 'FALSE_CALL'
 * @param {string} params.modelVersion - e.g., 'v1.2.3'
 * @param {string} params.customerCode - e.g., 'ACME'
 * @param {string} params.imageType - 'full' | 'crop'
 * @param {string} [params.defectType] - e.g., 'solder_bridge' (only for crop)
 * @param {Date} [params.timestamp] - Date object or null for now
 * @returns {string} Formatted filename
 */
export function generateImageFilename({
  side,
  result,
  modelVersion,
  customerCode,
  imageType,
  defectType = null,
  timestamp = null,
}) {
  const ts = timestamp || new Date();
  
  // Format date: YYYYMMDD
  const date = ts.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Format time: HHmmss
  const time = ts.toTimeString().slice(0, 8).replace(/:/g, '');
  
  // Normalize side (BOTTOM -> BOT)
  const sideCode = side === 'BOTTOM' ? 'BOT' : 'TOP';
  
  // Normalize result (FALSE_CALL -> FC)
  const resultCode = result === 'FALSE_CALL' ? 'FC' : result;
  
  // Clean model version (remove special chars except dot and dash)
  const modelClean = modelVersion.replace(/[^a-zA-Z0-9.-]/g, '');
  
  // Clean customer code (uppercase, alphanumeric only)
  const customerClean = customerCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Build filename
  let filename = `${date}_${time}_${sideCode}_${resultCode}_${modelClean}_${customerClean}_${imageType}`;
  
  // Add defect type for crop images
  if (imageType === 'crop' && defectType) {
    const defectClean = defectType.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    filename += `_${defectClean}`;
  }
  
  return `${filename}.png`;
}

/**
 * Generate full storage path
 * @param {Object} params
 * @param {string} params.woNumber - Work order number (e.g., 'WO-20260103-0001')
 * @param {number} params.boardSequence - Board sequence number
 * @param {string} params.side - 'TOP' | 'BOTTOM'
 * @param {string} params.result - 'GOOD' | 'NG' | 'FALSE_CALL'
 * @param {string} params.modelVersion - Model version
 * @param {string} params.customerCode - Customer code
 * @param {string} params.imageType - 'full' | 'crop'
 * @param {string} [params.defectType] - Defect type (for crop)
 * @param {Date} [params.timestamp] - Timestamp
 * @returns {string} Full storage path
 */
export function generateImagePath({
  woNumber,
  boardSequence,
  ...filenameParams
}) {
  const filename = generateImageFilename(filenameParams);
  const seqPadded = String(boardSequence).padStart(4, '0');
  
  return `${woNumber}/${seqPadded}/${filename}`;
}

/**
 * Parse filename back to metadata
 * @param {string} filename - Filename to parse
 * @returns {Object} Parsed metadata
 * 
 * @example
 * parseImageFilename('20260103_143052_TOP_NG_v1.2.3_ACME_crop_solder_bridge.png')
 * // Returns:
 * // {
 * //   date: '20260103',
 * //   time: '143052',
 * //   side: 'TOP',
 * //   result: 'NG',
 * //   model: 'v1.2.3',
 * //   customer: 'ACME',
 * //   type: 'crop',
 * //   defectType: 'solder_bridge'
 * // }
 */
export function parseImageFilename(filename) {
  // Remove extension
  const base = filename.replace(/\.png$/i, '');
  const parts = base.split('_');
  
  // Minimum parts: date, time, side, result, model, customer, type
  if (parts.length < 7) {
    return null;
  }
  
  const result = {
    date: parts[0],           // 20260103
    time: parts[1],           // 143052
    side: parts[2] === 'BOT' ? 'BOTTOM' : 'TOP',
    result: parts[3] === 'FC' ? 'FALSE_CALL' : parts[3],
    model: parts[4],          // v1.2.3
    customer: parts[5],       // ACME
    type: parts[6],           // full or crop
    defectType: parts.length > 7 ? parts.slice(7).join('_') : null,
  };
  
  return result;
}

/**
 * Parse full path to extract WO number, board sequence, and filename metadata
 * @param {string} path - Full path to parse
 * @returns {Object} Parsed path components
 * 
 * @example
 * parseImagePath('WO-20260103-0001/0002/20260103_143052_TOP_NG_v1.2.3_ACME_full.png')
 * // Returns:
 * // {
 * //   woNumber: 'WO-20260103-0001',
 * //   boardSequence: 2,
 * //   filename: '20260103_143052_TOP_NG_v1.2.3_ACME_full.png',
 * //   ...parsed filename metadata
 * // }
 */
export function parseImagePath(path) {
  const parts = path.split('/');
  
  if (parts.length < 3) {
    return null;
  }
  
  const woNumber = parts[0];
  const boardSequence = parseInt(parts[1], 10);
  const filename = parts[2];
  
  const filenameMeta = parseImageFilename(filename);
  
  return {
    woNumber,
    boardSequence,
    filename,
    ...filenameMeta,
  };
}

/**
 * Format date from filename date string
 * @param {string} dateStr - Date string (YYYYMMDD)
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
export function formatFilenameDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * Format time from filename time string
 * @param {string} timeStr - Time string (HHmmss)
 * @returns {string} Formatted time (HH:mm:ss)
 */
export function formatFilenameTime(timeStr) {
  if (!timeStr || timeStr.length !== 6) return null;
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
}

export default {
  generateImageFilename,
  generateImagePath,
  parseImageFilename,
  parseImagePath,
  formatFilenameDate,
  formatFilenameTime,
};

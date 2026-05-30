/**
 * Serial number type classification and display formatting.
 *
 * The backend provides 3 serial number conditions:
 *   1. Real barcode:   "PCBA-10011|E|PCI|20240803|000000052"  (pipe-delimited)
 *   2. Failed barcode: "20260217_141638"                       (YYYYMMDD_HHMMSS timestamp)
 *   3. Empty cavity:   "0"                                     (no PCB inserted)
 */

export const SN_TYPE = {
  BARCODE: 'barcode',
  TIMESTAMP: 'timestamp',
  EMPTY: 'empty',
}

/**
 * Classify a serial number string into one of the 3 conditions.
 * @param {string|null|undefined} sn
 * @returns {'barcode'|'timestamp'|'empty'}
 */
export function classifySerialNumber(sn) {
  if (!sn || String(sn) === '0') return SN_TYPE.EMPTY
  const s = String(sn)
  if (s.includes('|')) return SN_TYPE.BARCODE
  if (/^\d{8}_\d{6}$/.test(s)) return SN_TYPE.TIMESTAMP
  // Unknown format — treat as barcode (could be legacy SN-XXXXXX or real barcode without pipes)
  return SN_TYPE.BARCODE
}

/**
 * Check if a serial number represents an actual PCB (not empty cavity).
 * Both barcode and timestamp SNs indicate a real PCB is present.
 */
export function isRealPcb(sn) {
  return classifySerialNumber(sn) !== SN_TYPE.EMPTY
}

/**
 * Check if a serial number indicates a failed barcode read.
 */
export function isFailedBarcode(sn) {
  return classifySerialNumber(sn) === SN_TYPE.TIMESTAMP
}

/**
 * Format a serial number for display.
 * - Barcode: shows the full pipe-delimited string
 * - Timestamp: shows "NO READ" prefix + formatted timestamp
 * - Empty: returns null (should not be displayed)
 *
 * @param {string|null|undefined} sn
 * @returns {string|null}
 */
export function formatSerialDisplay(sn) {
  const type = classifySerialNumber(sn)
  if (type === SN_TYPE.EMPTY) return null
  if (type === SN_TYPE.TIMESTAMP) {
    // Format YYYYMMDD_HHMMSS → "HH:MM:SS"
    const s = String(sn)
    const time = `${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`
    return time
  }
  // Barcode — return as-is
  return String(sn)
}

/**
 * Model-to-static-image mapping.
 * Maps AI model/board names to static reference PCB images.
 *
 * When a model has static images configured, these are used instead of
 * SSE stream images. The bbox coordinates from SSE objects[].box are
 * relative to these image dimensions.
 */

const MODEL_IMAGE_MAP = {
  'EV10-035790-0000': {
    top: '/images/PCB-3/pcb-3-top.png',
    bottom: '/images/PCB-3/pcb-3-bottom.png',
  },
}

/**
 * Get static image path for a model + side.
 * @param {string} modelName - Board/model name (e.g. 'EV10-035790-0000')
 * @param {'top'|'bottom'|'TOP'|'BOTTOM'} side - Frame side
 * @returns {string|null} Static image path or null if not configured
 */
export function getModelImage(modelName, side) {
  if (!modelName) return null
  const entry = MODEL_IMAGE_MAP[modelName]
  if (!entry) return null
  const normalizedSide = side?.toLowerCase()
  return entry[normalizedSide] || null
}

/**
 * Check if a model has static images configured.
 * @param {string} modelName
 * @returns {boolean}
 */
export function hasModelImages(modelName) {
  return !!MODEL_IMAGE_MAP[modelName]
}

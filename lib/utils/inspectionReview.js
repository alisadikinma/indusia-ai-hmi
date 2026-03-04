/**
 * Normalize a bounding box so that x1 < x2 and y1 < y2.
 * Some AI backends return coordinates with inverted axes (e.g., y-axis
 * origin at bottom instead of top). This ensures consistent top-left to
 * bottom-right ordering for HTML/Canvas rendering.
 *
 * @param {number[]} box - [x1, y1, x2, y2] in any order
 * @returns {number[]} [minX, minY, maxX, maxY]
 */
export function normalizeBox(box) {
  if (!box || box.length < 4) return box
  const [a, b, c, d] = box
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
}

// Native camera resolution: Hikrobot MV-CS200-10GC (Auto Inspect Edge captures at this size)
const CAMERA_NATIVE_WIDTH = 5472
const CAMERA_NATIVE_HEIGHT = 3648

/**
 * Compute scale factors to map bbox coordinates to the served image dimensions.
 *
 * Auto Inspect Edge returns bbox coords at native camera resolution (5472×3648).
 * When visualization images are served at a lower resolution (e.g., via AI Engine
 * at port 8001), bbox coords must be scaled down to match the served image size.
 *
 * Detection: if any bbox coordinate exceeds the served image dimension, the coords
 * are in native camera space and need to be scaled to match the loaded image.
 *
 * @param {{ width: number, height: number } | null} imageSize - Natural image dimensions
 * @param {Array<{ box: number[] }>} objects - Objects with box: [x1,y1,x2,y2]
 * @returns {{ x: number, y: number }} Scale factors (1:1 if no mismatch detected)
 */
export function computeBboxScale(imageSize, objects) {
  if (!imageSize || !objects || objects.length === 0) return { x: 1, y: 1 }

  // Check if any bbox coordinate significantly exceeds the served image dimensions.
  // A 5% tolerance handles minor rounding differences.
  const hasOversizedCoords = objects.some(o => {
    if (!o || !o.box || o.box.length < 4) return false
    return Math.max(o.box[0], o.box[2]) > imageSize.width * 1.05 ||
           Math.max(o.box[1], o.box[3]) > imageSize.height * 1.05
  })

  if (!hasOversizedCoords) return { x: 1, y: 1 }

  // Bbox coords are in native camera resolution — scale down to match served image
  return {
    x: imageSize.width / CAMERA_NATIVE_WIDTH,
    y: imageSize.height / CAMERA_NATIVE_HEIGHT,
  }
}

/**
 * Remove sub-component detections (e.g. individual connector pins) that are
 * spatially contained within a larger detection of the same component name.
 *
 * The AI model often detects both the connector as a whole (large bbox) and
 * each individual pin contact (many small bboxes). For operator review, only
 * the connector-level detection is needed — the pin-level detections are noise.
 *
 * Rule: if the smaller object's bbox is >75% inside the larger object's bbox,
 * AND the larger object is at least 3× the area of the smaller, remove the smaller.
 *
 * @param {Array<{ name: string, box: number[] }>} objects - Parent objects (no sub-boxes)
 * @returns {Array} Filtered objects with contained sub-component detections removed
 */
export function deduplicateContainedObjects(objects) {
  if (objects.length <= 1) return objects

  const bboxArea = (box) => {
    if (!box || box.length < 4) return 0
    const [x1, y1, x2, y2] = normalizeBox(box)
    return Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  }

  const intersectionArea = (boxA, boxB) => {
    const [ax1, ay1, ax2, ay2] = normalizeBox(boxA)
    const [bx1, by1, bx2, by2] = normalizeBox(boxB)
    const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1)
    const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2)
    if (ix2 <= ix1 || iy2 <= iy1) return 0
    return (ix2 - ix1) * (iy2 - iy1)
  }

  const CONTAINMENT_THRESHOLD = 0.75 // smaller box must be >75% inside larger
  const MIN_AREA_RATIO = 3            // larger must be ≥3× the area of smaller

  const toRemove = new Set()

  for (let i = 0; i < objects.length; i++) {
    if (toRemove.has(i)) continue
    for (let j = i + 1; j < objects.length; j++) {
      if (toRemove.has(j)) continue
      if (objects[i].name !== objects[j].name) continue

      const areaI = bboxArea(objects[i].box)
      const areaJ = bboxArea(objects[j].box)
      if (areaI === 0 || areaJ === 0) continue

      // Only deduplicate when one object is significantly larger than the other
      const areaRatio = Math.max(areaI, areaJ) / Math.min(areaI, areaJ)
      if (areaRatio < MIN_AREA_RATIO) continue

      const interArea = intersectionArea(objects[i].box, objects[j].box)
      if (interArea === 0) continue

      const smallerArea = Math.min(areaI, areaJ)
      if (interArea / smallerArea > CONTAINMENT_THRESHOLD) {
        // Remove the smaller object (it's a pin/sub-component of the larger one)
        toRemove.add(areaI < areaJ ? i : j)
      }
    }
  }

  return objects.filter((_, idx) => !toRemove.has(idx))
}

/**
 * Find the next unreviewed frame index using wrap-around search.
 * @param {Array<{side: string, frameIndex: number}>} frames - Array of NG frames
 * @param {Object} decisions - Map of `${side}-${frameIndex}` → decision value
 * @param {number} startIndex - Index to start searching from
 * @returns {number} Index of next unreviewed frame, or -1 if all reviewed
 */
export function findNextUnreviewedFrame(frames, decisions, startIndex) {
  if (Object.keys(decisions).length >= frames.length) return -1
  for (let i = 0; i < frames.length; i++) {
    const idx = (startIndex + i) % frames.length
    const key = `${frames[idx].side}-${frames[idx].frameIndex}`
    if (!decisions[key]) return idx
  }
  return -1
}

/**
 * Compute per-PCB counts by grouping frames by serial_number.
 * TOP and BOTTOM frames with the same serial_number = 1 physical PCB.
 * A PCB is NG if ANY of its frames is REAL_NG; otherwise GOOD (false call).
 *
 * When serial_number is not available, falls back to computing a PCB index
 * from the frame's position within its side: pcbIndex = floor(frameIndex / framesPerPcb).
 * This correctly handles models where TOP and BOTTOM sides have different frame counts
 * (e.g., TOP has 2 frames per PCB, BOTTOM has 1 frame per PCB).
 *
 * @param {Array<{side: string, frameIndex: number, serial_number?: string}>} frames - NG frames
 * @param {Object} decisions - Map of `${side}-${frameIndex}` → 'REAL_NG' | reason string
 * @param {Object} [frameLayout] - Optional frame layout info for accurate fallback grouping
 * @param {number} [frameLayout.cavityCount] - Number of physical PCBs per panel
 * @param {number} [frameLayout.topFrameCount] - Total TOP frames in the inspection (not just NG)
 * @param {number} [frameLayout.bottomFrameCount] - Total BOTTOM frames in the inspection (not just NG)
 * @returns {{ ngPcbs: number, goodPcbs: number }}
 */
export function computePcbCounts(frames, decisions, frameLayout) {
  const cavityCount = frameLayout?.cavityCount || 0
  const topTotal = frameLayout?.topFrameCount || 0
  const bottomTotal = frameLayout?.bottomFrameCount || 0

  // Precompute frames-per-PCB for each side (used when serial_number is null)
  const topPerPcb = (cavityCount > 0 && topTotal > 0) ? topTotal / cavityCount : 0
  const bottomPerPcb = (cavityCount > 0 && bottomTotal > 0) ? bottomTotal / cavityCount : 0

  const pcbMap = new Map()
  let emptyPcbs = 0
  const seenEmpty = new Set()
  frames.forEach(frame => {
    // SN "0" = empty cavity (no PCB inserted) — skip from counting entirely
    const sn = String(frame.serial_number ?? '')
    if (sn === '0') {
      // Track unique empty slots (same SN "0" on TOP+BOTTOM = 1 empty cavity)
      const emptyKey = cavityCount > 0
        ? `empty-${Math.floor(frame.frameIndex / ((frame.side === 'TOP' ? topPerPcb : bottomPerPcb) || 1))}`
        : `empty-${frame.frameIndex}`
      seenEmpty.add(emptyKey)
      return
    }

    const key = `${frame.side}-${frame.frameIndex}`
    const decision = decisions[key]

    let pcbId
    if (frame.serial_number) {
      // Best case: group by serial_number (same SN on TOP and BOTTOM = same PCB)
      pcbId = frame.serial_number
    } else if (cavityCount > 0) {
      // Fallback: compute PCB index from frame position within its side.
      // E.g., TOP has 4 frames, 2 cavities → frames 0,1 = PCB 0, frames 2,3 = PCB 1
      const perPcb = frame.side === 'TOP' ? topPerPcb : bottomPerPcb
      const pcbIndex = perPcb > 0 ? Math.floor(frame.frameIndex / perPcb) : frame.frameIndex
      pcbId = `cavity-${pcbIndex}`
    } else {
      // Last resort: group by frameIndex (works when top/bottom have equal frame counts)
      pcbId = `cavity-${frame.frameIndex}`
    }

    if (!pcbMap.has(pcbId)) pcbMap.set(pcbId, { hasRealNG: false, hasFalseCall: false })
    const pcb = pcbMap.get(pcbId)
    if (decision === 'REAL_NG') pcb.hasRealNG = true
    else if (decision) pcb.hasFalseCall = true
  })

  emptyPcbs = seenEmpty.size
  let ngPcbs = 0
  let goodPcbs = 0
  for (const pcb of pcbMap.values()) {
    if (pcb.hasRealNG) ngPcbs++
    else if (pcb.hasFalseCall) goodPcbs++
  }
  return { ngPcbs, goodPcbs, emptyPcbs }
}

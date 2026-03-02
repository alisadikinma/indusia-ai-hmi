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

/**
 * Compute scale factors to map bbox coordinates to image dimensions.
 *
 * AI backends often return bounding boxes in model inference resolution
 * (e.g., 640x480) while the displayed image is the original high-res
 * capture (e.g., 2400x1792). This function detects the mismatch and
 * returns the scale factors needed to map bbox coordinates to image space.
 *
 * Detection heuristic: if ALL bbox coordinates fit within a small extent
 * compared to the image, AND the X/Y scale ratios are similar (isotropic),
 * it indicates a resolution mismatch rather than detections in one corner.
 *
 * @param {{ width: number, height: number }} imageSize - Natural image dimensions
 * @param {Array<{ box: number[] }>} objects - Objects with box: [x1,y1,x2,y2]
 * @returns {{ x: number, y: number }} Scale factors (1.0 = no scaling needed)
 */
export function computeBboxScale(imageSize, objects) {
  if (!imageSize || !objects || objects.length === 0) return { x: 1, y: 1 }

  let maxX = 0, maxY = 0
  for (const obj of objects) {
    if (!obj.box || obj.box.length < 4) continue
    const [x1, y1, x2, y2] = normalizeBox(obj.box)
    maxX = Math.max(maxX, x1, x2)
    maxY = Math.max(maxY, y1, y2)
  }

  if (maxX < 1 || maxY < 1) return { x: 1, y: 1 }

  const rx = imageSize.width / maxX
  const ry = imageSize.height / maxY

  // Coords larger than image (rx < 1 or ry < 1) — scale down to fit image
  if (rx < 1 || ry < 1) {
    return { x: rx, y: ry }
  }

  // Both axes need significant scaling (>2.5x) — coords are clearly smaller than image
  if (rx <= 2.5 || ry <= 2.5) return { x: 1, y: 1 }

  // Check isotropic: ratios should be within 20% of each other.
  // A true resolution mismatch scales uniformly; corner-only detections won't.
  const ratioDiff = Math.abs(rx - ry) / Math.max(rx, ry)
  if (ratioDiff > 0.2) return { x: 1, y: 1 }

  // Use per-axis scaling (handles slight aspect ratio differences)
  return { x: rx, y: ry }
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

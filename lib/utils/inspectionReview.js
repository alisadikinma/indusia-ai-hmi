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

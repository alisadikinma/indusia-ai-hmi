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
 * @param {Array<{side: string, frameIndex: number, serial_number?: string}>} frames - NG frames
 * @param {Object} decisions - Map of `${side}-${frameIndex}` → 'REAL_NG' | reason string
 * @returns {{ ngPcbs: number, goodPcbs: number }}
 */
export function computePcbCounts(frames, decisions) {
  const pcbMap = new Map()
  frames.forEach(frame => {
    const key = `${frame.side}-${frame.frameIndex}`
    const decision = decisions[key]
    // Group by serial_number — same SN on TOP and BOTTOM = same physical PCB.
    // Fallback to frameIndex if serial_number is not available.
    const pcbId = frame.serial_number || `cavity-${frame.frameIndex}`
    if (!pcbMap.has(pcbId)) pcbMap.set(pcbId, { hasRealNG: false, hasFalseCall: false })
    const pcb = pcbMap.get(pcbId)
    if (decision === 'REAL_NG') pcb.hasRealNG = true
    else if (decision) pcb.hasFalseCall = true
  })

  let ngPcbs = 0
  let goodPcbs = 0
  for (const pcb of pcbMap.values()) {
    if (pcb.hasRealNG) ngPcbs++
    else if (pcb.hasFalseCall) goodPcbs++
  }
  return { ngPcbs, goodPcbs }
}

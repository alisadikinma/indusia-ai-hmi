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

/**
 * Line State Store (shared module)
 *
 * Exports the in-memory line-state cache so it can be read by
 * both the line-state API route and other services (e.g. update pipeline).
 *
 * The line-state route writes to this store. Other consumers read only.
 */

import fs from 'fs'
import path from 'path'

const STATE_FILE = path.join(process.cwd(), '.line-state.json')

// In-memory cache — singleton across the Next.js process
let lineStateCache = null

/**
 * Ensure the cache is loaded (from file on first access).
 */
export function ensureCache() {
  if (lineStateCache !== null) return lineStateCache

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8')
      lineStateCache = new Map(JSON.parse(data))
    }
  } catch (err) {
    console.warn('[LineStateStore] Corrupt state file, resetting:', err.message)
    try { fs.unlinkSync(STATE_FILE) } catch (_) { /* ignore */ }
  }

  if (!lineStateCache) {
    lineStateCache = new Map()
  }

  return lineStateCache
}

/**
 * Get state for a specific line.
 */
export function getLineState(lineId) {
  const cache = ensureCache()
  return cache.get(lineId) || null
}

/**
 * Get all line states as an array of [lineId, state] entries.
 */
export function getAllLineStates() {
  const cache = ensureCache()
  return [...cache.entries()]
}

/**
 * Set state for a specific line (used by line-state route).
 */
export function setLineState(lineId, data) {
  const cache = ensureCache()
  cache.set(lineId, data)
}

/**
 * Bump woCounterVersion for a line (called when WO counters change externally,
 * e.g. override review patches counters). Clients detect this and trigger refreshWO().
 */
export function bumpWoCounterVersion(lineId) {
  const cache = ensureCache()
  const current = cache.get(lineId)
  if (!current) return
  cache.set(lineId, { ...current, woCounterVersion: Date.now() })
}

/**
 * Get the raw Map reference (for line-state route persistence).
 */
export function getCache() {
  return ensureCache()
}

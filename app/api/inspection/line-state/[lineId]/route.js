/**
 * Line State API
 *
 * Stores shared state per line so all clients see the same state.
 * Includes: process status, auto-ng, stage info, and current inspection.
 *
 * GET: Fetch current state (from memory - fast)
 * PUT: Update state (operator only, writes to memory + async file backup)
 *
 * Uses in-memory Map for fast reads, with file backup for persistence.
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// File path for persistence (backup only - not read on every request)
const STATE_FILE = path.join(process.cwd(), '.line-state.json')

// In-memory cache - loaded from file once at startup
let lineStateCache = null

// Load cache from file (called once on first access)
function ensureCache() {
  if (lineStateCache !== null) return lineStateCache

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8')
      lineStateCache = new Map(JSON.parse(data))
    }
  } catch (err) {
    console.warn('[LineState] Failed to read state file:', err.message)
  }

  if (!lineStateCache) {
    lineStateCache = new Map()
  }

  return lineStateCache
}

// Persist cache to file (async - doesn't block response)
function persistToFile() {
  try {
    const data = JSON.stringify([...lineStateCache.entries()])
    fs.writeFile(STATE_FILE, data, 'utf-8', (err) => {
      if (err) console.warn('[LineState] Failed to persist state file:', err.message)
    })
  } catch (err) {
    console.warn('[LineState] Failed to serialize state:', err.message)
  }
}

// Default state for a line
const getDefaultState = () => ({
  autoNgEnabled: true,
  processStatus: 'IDLE',
  stage: {
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 7
  },
  hardware: {
    cameras: [],
    plcs: []
  },
  currentInspection: null,
  updatedAt: new Date().toISOString(),
  updatedBy: null
})

// GET /api/inspection/line-state/[lineId]
export async function GET(request, { params }) {
  try {
    const { lineId } = await params

    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Line ID required' },
        { status: 400 }
      )
    }

    const cache = ensureCache()

    // Get or create default state
    if (!cache.has(lineId)) {
      const defaultState = getDefaultState()
      cache.set(lineId, defaultState)
      persistToFile()
    }

    const state = cache.get(lineId)

    return NextResponse.json({
      success: true,
      data: state
    })
  } catch (error) {
    console.error('[LineState API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/inspection/line-state/[lineId]
export async function PUT(request, { params }) {
  try {
    const { lineId } = await params
    const body = await request.json()

    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Line ID required' },
        { status: 400 }
      )
    }

    const cache = ensureCache()

    // Get current state or default
    const currentState = cache.get(lineId) || getDefaultState()

    // Update only provided fields (pass-through stage as-is from operator)
    const updatedState = {
      ...currentState,
      ...(body.autoNgEnabled !== undefined && { autoNgEnabled: Boolean(body.autoNgEnabled) }),
      ...(body.processStatus !== undefined && { processStatus: body.processStatus }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.hardware !== undefined && { hardware: body.hardware }),
      ...(body.currentInspection !== undefined && { currentInspection: body.currentInspection }),
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || null
    }

    // Save to memory (instant) + persist to file (async)
    cache.set(lineId, updatedState)
    persistToFile()

    return NextResponse.json({
      success: true,
      data: updatedState
    })
  } catch (error) {
    console.error('[LineState API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

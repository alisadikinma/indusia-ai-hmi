/**
 * Line State API
 *
 * Stores shared state per line so all clients see the same state.
 * Includes: process status, auto-ng, stage info, and current inspection.
 *
 * GET: Fetch current state (from memory - fast)
 * PUT: Update state (operator only, writes to memory + async file backup)
 *
 * Uses shared lineStateStore for in-memory reads, with file backup for persistence.
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getCache, setLineState } from '@/lib/services/lineStateStore'

// File path for persistence (backup only - not read on every request)
const STATE_FILE = path.join(process.cwd(), '.line-state.json')

let writeInFlight = false

// Persist cache to file (async, atomic write via temp file, skip if write already in-flight)
function persistToFile() {
  const cache = getCache()
  if (writeInFlight) return // skip — previous write still pending
  try {
    const data = JSON.stringify([...cache.entries()])
    const tmpFile = STATE_FILE + '.tmp'
    writeInFlight = true
    fs.writeFile(tmpFile, data, 'utf-8', (err) => {
      writeInFlight = false
      if (err) {
        console.warn('[LineState] Failed to write temp state file:', err.message)
        return
      }
      // Atomic rename — prevents reading a half-written file
      fs.rename(tmpFile, STATE_FILE, (renameErr) => {
        if (renameErr) console.warn('[LineState] Failed to rename state file:', renameErr.message)
      })
    })
  } catch (err) {
    writeInFlight = false
    console.warn('[LineState] Failed to serialize state:', err.message)
  }
}

// Default state for a line
const getDefaultState = () => ({
  autoNgEnabled: false,
  processStatus: 'IDLE',
  stage: {
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 0  // Dynamic — set by operator's SSE stage events
  },
  hardware: {
    cameras: [],
    plcs: []
  },
  currentInspection: null,
  modelName: null,
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

    const cache = getCache()

    // Get or create default state
    if (!cache.has(lineId)) {
      const defaultState = getDefaultState()
      setLineState(lineId, defaultState)
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

    const cache = getCache()

    // Get current state or default
    const currentState = cache.get(lineId) || getDefaultState()

    // Update only provided fields (pass-through stage as-is from operator)
    // Note: woCounterVersion is preserved — only bumpWoCounterVersion() sets it
    const updatedState = {
      ...currentState,
      ...(body.autoNgEnabled !== undefined && { autoNgEnabled: Boolean(body.autoNgEnabled) }),
      ...(body.processStatus !== undefined && { processStatus: body.processStatus }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.hardware !== undefined && { hardware: body.hardware }),
      ...(body.currentInspection !== undefined && { currentInspection: body.currentInspection }),
      ...(body.modelName !== undefined && { modelName: body.modelName }),
      ...(body.workOrderCounters !== undefined && { workOrderCounters: body.workOrderCounters }),
      ...(body.cycleTime !== undefined && { cycleTime: body.cycleTime }),
      woCounterVersion: currentState.woCounterVersion || 0,
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || null
    }

    // Save to memory (instant) + persist to file (async)
    setLineState(lineId, updatedState)
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

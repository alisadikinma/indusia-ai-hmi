/**
 * Line State API
 * 
 * Stores shared state per line so all clients see the same state.
 * Includes: process status, auto-ng, stage info, and current inspection.
 * 
 * GET: Fetch current state
 * PUT: Update state (operator only)
 * 
 * Uses file-based storage to persist across Next.js workers in dev mode.
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// File-based store for line state (persists across Next.js workers)
const STATE_FILE = path.join(process.cwd(), '.line-state.json')

// Read state from file
function readStateStore() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8')
      return new Map(JSON.parse(data))
    }
  } catch (err) {
    console.warn('[LineState] Failed to read state file:', err.message)
  }
  return new Map()
}

// Write state to file
function writeStateStore(store) {
  try {
    const data = JSON.stringify([...store.entries()])
    fs.writeFileSync(STATE_FILE, data, 'utf-8')
  } catch (err) {
    console.warn('[LineState] Failed to write state file:', err.message)
  }
}

// Default state for a line
const getDefaultState = () => ({
  // Process control
  autoNgEnabled: true,
  processStatus: 'IDLE', // IDLE, RUNNING, PAUSED, STOPPED
  
  // Stage info (7 stages for dual-side PCB inspection)
  stage: {
    status: 'idle',
    stageName: 'idle',
    message: 'Waiting for board...',
    stageIndex: 0,
    totalStages: 7
  },
  
  // Hardware status
  hardware: {
    cameras: [],
    plcs: []
  },
  
  // Current inspection (null if none)
  currentInspection: null,
  
  // Metadata
  updatedAt: new Date().toISOString(),
  updatedBy: null
})

// Validate and fix state if it has incorrect values
const validateState = (state) => {
  const fixedState = { ...state }
  
  // Fix totalStages if incorrect (must be 7 for dual-side PCB)
  if (fixedState.stage && fixedState.stage.totalStages !== 7) {
    console.log('[LineState API] Fixing totalStages:', fixedState.stage.totalStages, '→ 7')
    fixedState.stage = {
      ...fixedState.stage,
      totalStages: 7
    }
  }
  
  // Ensure autoNgEnabled is boolean
  if (typeof fixedState.autoNgEnabled !== 'boolean') {
    fixedState.autoNgEnabled = true
  }
  
  return fixedState
}

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

    // Read from file
    const lineStateStore = readStateStore()

    // Get or create default state
    if (!lineStateStore.has(lineId)) {
      const defaultState = getDefaultState()
      lineStateStore.set(lineId, defaultState)
      writeStateStore(lineStateStore)
    }

    let state = lineStateStore.get(lineId)
    
    // Validate and fix state if needed
    const validatedState = validateState(state)
    if (JSON.stringify(state) !== JSON.stringify(validatedState)) {
      // State was fixed, save it
      lineStateStore.set(lineId, validatedState)
      writeStateStore(lineStateStore)
      state = validatedState
    }
    
    // DEBUG log disabled - uncomment for troubleshooting
    // console.log(`[LineState API] GET line ${lineId} autoNgEnabled:`, state.autoNgEnabled)

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
    
    // DEBUG log disabled - uncomment for troubleshooting
    // console.log(`[LineState API] PUT line ${lineId}:`, {
    //   autoNgEnabled: body.autoNgEnabled,
    //   hasProcessStatus: body.processStatus !== undefined,
    //   hasStage: body.stage !== undefined,
    //   updatedBy: body.updatedBy
    // })
    
    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Line ID required' },
        { status: 400 }
      )
    }

    // Read current store from file
    const lineStateStore = readStateStore()

    // Get current state or default
    const currentState = lineStateStore.get(lineId) || getDefaultState()

    // Update only provided fields
    let updatedState = {
      ...currentState,
      ...(body.autoNgEnabled !== undefined && { autoNgEnabled: body.autoNgEnabled }),
      ...(body.processStatus !== undefined && { processStatus: body.processStatus }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.hardware !== undefined && { hardware: body.hardware }),
      ...(body.currentInspection !== undefined && { currentInspection: body.currentInspection }),
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || null
    }
    
    // Validate state before saving
    updatedState = validateState(updatedState)

    // Save to store and persist to file
    lineStateStore.set(lineId, updatedState)
    writeStateStore(lineStateStore)

    // DEBUG log disabled - uncomment for troubleshooting
    // console.log(`[LineState API] Saved line ${lineId} autoNgEnabled:`, updatedState.autoNgEnabled)

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

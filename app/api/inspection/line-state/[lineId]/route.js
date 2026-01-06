/**
 * Line State API
 * 
 * Stores shared state per line so all clients see the same state.
 * Includes: process status, auto-ng, stage info, and current inspection.
 * 
 * GET: Fetch current state
 * PUT: Update state (operator only)
 */

import { NextResponse } from 'next/server'

// In-memory store for line state
// In production, this should be Redis or database for persistence across restarts
const lineStateStore = new Map()

// Default state for a line
const getDefaultState = () => ({
  // Process control
  autoNgEnabled: true,
  processStatus: 'IDLE', // IDLE, RUNNING, PAUSED, STOPPED
  
  // Stage info
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

    // Get or create default state
    if (!lineStateStore.has(lineId)) {
      lineStateStore.set(lineId, getDefaultState())
    }

    const state = lineStateStore.get(lineId)
    
    // DEBUG: Log what we're returning
    console.log(`[LineState API] GET line ${lineId} autoNgEnabled:`, state.autoNgEnabled)

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
    
    // DEBUG: Log incoming request
    console.log(`[LineState API] PUT line ${lineId}:`, {
      autoNgEnabled: body.autoNgEnabled,
      hasProcessStatus: body.processStatus !== undefined,
      hasStage: body.stage !== undefined,
      updatedBy: body.updatedBy
    })
    
    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Line ID required' },
        { status: 400 }
      )
    }

    // Get current state or default
    const currentState = lineStateStore.get(lineId) || getDefaultState()

    // Update only provided fields
    const updatedState = {
      ...currentState,
      ...(body.autoNgEnabled !== undefined && { autoNgEnabled: body.autoNgEnabled }),
      ...(body.processStatus !== undefined && { processStatus: body.processStatus }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.hardware !== undefined && { hardware: body.hardware }),
      ...(body.currentInspection !== undefined && { currentInspection: body.currentInspection }),
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || null
    }

    lineStateStore.set(lineId, updatedState)

    // DEBUG: Log saved state
    console.log(`[LineState API] Saved line ${lineId} autoNgEnabled:`, updatedState.autoNgEnabled)

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

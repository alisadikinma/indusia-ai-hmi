/**
 * Batch Select-Line Data API
 * GET /api/inspection/select-line-data
 *
 * Returns sections, lines, boards, and per-line data (active WO, stats, line-state)
 * in a single request. Eliminates the N+1 problem where select-line page made
 * 3 calls per line (work-orders/active, inspection/stats, line-state).
 *
 * This endpoint performs ONE auth check instead of 3 + 3N checks.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import * as masterDataRepo from '@/lib/repos/masterDataRepo'
import fs from 'fs'
import path from 'path'

const STATE_FILE = path.join(process.cwd(), '.line-state.json')

// Read all line states from file (the in-memory cache is in the line-state route module)
function readAllLineStates() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8')
      return new Map(JSON.parse(data))
    }
  } catch (err) {
    console.warn('[SelectLineData] Failed to read line-state file:', err.message)
  }
  return new Map()
}

/**
 * GET /api/inspection/select-line-data
 * No auth required — used by all roles including view-only
 */
export async function GET() {
  try {
    // Parallel: fetch master data + all active WOs + all line states
    const [
      sectionsResult,
      linesResult,
      boardsResult,
      activeWOsResult,
      lineStates
    ] = await Promise.all([
      masterDataRepo.getSections(),
      masterDataRepo.getLines(),
      masterDataRepo.getBoards(),
      // Fetch ALL active work orders in one query (not per-line)
      supabase
        .from('work_orders')
        .select(`
          id, wo_number, lot_size, side_count,
          completed_qty, good_qty, ng_qty, false_call_qty,
          status, line_id, started_at, created_at,
          customer:customers(id, name, code),
          board:boards(id, name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      // Read line states from file
      Promise.resolve(readAllLineStates())
    ])

    const sections = sectionsResult.data || []
    const lines = linesResult.data || []
    const boards = boardsResult.data || []

    // Index active WOs by line_id (latest per line)
    const woByLine = new Map()
    if (activeWOsResult.data) {
      for (const wo of activeWOsResult.data) {
        // Only keep latest (first, since ordered by created_at desc)
        if (!woByLine.has(wo.line_id)) {
          woByLine.set(wo.line_id, wo)
        }
      }
    }

    // Build enriched line data
    const enrichedLines = lines.map(line => {
      const lineData = {
        id: line.id,
        name: line.name,
        sectionId: line.sectionId,
        customerId: line.customerId,
        customer: line.customers || null,
        status: 'idle',
        customerName: line.customers?.name || null,
        customerCode: line.customers?.code || null,
        woNumber: null,
        woBoardName: null,
        woRemaining: 0,
        lotSize: 0,
        startedAt: null,
        operatorId: null,
        operatorName: null,
        activeModelName: null,
        inspected: 0,
        goodQty: 0,
        ngQty: 0,
        yield: 0,
      }

      // Apply active work order data
      const wo = woByLine.get(line.id)
      if (wo) {
        lineData.woNumber = wo.wo_number
        lineData.lotSize = wo.lot_size || 0
        lineData.woBoardName = wo.board?.name || null
        lineData.woRemaining = (wo.lot_size || 0) - (wo.completed_qty || 0)
        lineData.startedAt = wo.started_at || wo.created_at
        lineData.inspected = wo.completed_qty || 0
        lineData.goodQty = wo.good_qty || 0
        lineData.ngQty = wo.ng_qty || 0
        lineData.yield = lineData.inspected > 0
          ? (lineData.goodQty / lineData.inspected) * 100
          : 0
        if (wo.customer?.name) {
          lineData.customerName = wo.customer.name
          lineData.customerCode = wo.customer.code || lineData.customerCode
        }
      }

      // Apply line-state data
      const state = lineStates.get(line.id)
      if (state) {
        const statusMap = {
          'RUNNING': 'running',
          'PAUSED': 'paused',
          'STOPPED': 'stopped',
          'IDLE': 'idle',
          'READY': 'idle'
        }
        lineData.status = statusMap[state.processStatus] || 'idle'
        if (state.updatedBy) lineData.operatorName = state.updatedBy

        const modelName = state.modelName
          || state.currentInspection?.modelName
          || state.currentInspection?.model_name
          || null
        if (modelName) lineData.activeModelName = modelName
      } else if (wo) {
        // Has WO but no line-state → idle (not yet started by operator)
        lineData.status = 'idle'
      }

      return lineData
    })

    return NextResponse.json({
      success: true,
      data: {
        sections,
        lines: enrichedLines,
        boards,
      }
    })
  } catch (error) {
    console.error('[API] GET /inspection/select-line-data error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

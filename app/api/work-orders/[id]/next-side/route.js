/**
 * Next Side Logic
 * Determines what happens after current side inspection
 * Returns: FLIP, NEXT_PCB, or COMPLETED
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { supabase } from '@/lib/supabaseClient'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const nextSideSchema = z.object({
  current_side: z.enum(['top', 'bottom'])
})

async function handlePOST(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()

    const validation = validate(nextSideSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 })
    }

    const { current_side } = validation.data

    // Get work order with current state
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Work order not found'
        }, { status: 404 })
      }
      throw error
    }

    let nextAction, nextSide

    // Determine next action based on current side and board configuration
    if (current_side === 'top' && wo.board_sides === 2) {
      // Two-sided board, just finished top -> flip to bottom
      nextAction = 'FLIP'
      nextSide = 'bottom'
    } else if (current_side === 'bottom' || wo.board_sides === 1) {
      // Finished bottom side OR single-sided board -> next PCB
      nextAction = 'NEXT_PCB'
      nextSide = 'top'
    } else {
      // Default fallback
      nextAction = 'NEXT_PCB'
      nextSide = 'top'
    }

    // Check if WO should complete
    const totalInspected = wo.inspected_good + wo.inspected_ng
    if (totalInspected >= wo.lot_size) {
      nextAction = 'COMPLETED'
    }

    // Calculate yield
    const yieldPercent = totalInspected > 0
      ? ((wo.inspected_good / totalInspected) * 100).toFixed(1)
      : '0.0'

    return NextResponse.json({
      success: true,
      data: {
        next_action: nextAction,
        next_side: nextSide,
        work_order: {
          id: wo.id,
          status: wo.status,
          board_sides: wo.board_sides
        },
        progress: {
          inspected_good: wo.inspected_good,
          inspected_ng: wo.inspected_ng,
          total_inspected: totalInspected,
          lot_size: wo.lot_size,
          remaining: Math.max(0, wo.lot_size - totalInspected),
          yield_percent: parseFloat(yieldPercent),
          progress_percent: ((totalInspected / wo.lot_size) * 100).toFixed(1)
        }
      }
    })
  } catch (error) {
    console.error('POST /api/work-orders/[id]/next-side error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export const POST = withAuth('work-orders:read')(handlePOST)

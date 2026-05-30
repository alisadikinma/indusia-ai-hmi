/**
 * Atomic Inspection Submit
 * Handles all inspection submission logic in a single transaction:
 * 1. Save inspection result
 * 2. Update work order counters
 * 3. Log to event_log
 * 4. Add to sync queue (if false call)
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { supabase } from '@/lib/supabaseClient'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const submitSchema = z.object({
  inspection_id: z.string().min(1),
  work_order_id: z.string().uuid(),
  operator_decision: z.enum(['GOOD', 'NG']),
  ai_decision: z.enum(['PASS', 'FAIL']),
  side: z.enum(['top', 'bottom']),
  false_call_reason_id: z.string().uuid().optional().nullable(),
  comment: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  detections: z.array(z.any()).optional().nullable()
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(submitSchema, body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 })
    }

    const {
      inspection_id,
      work_order_id,
      operator_decision,
      ai_decision,
      side,
      false_call_reason_id,
      comment,
      image_url,
      detections
    } = validation.data

    // Determine if this is a false call
    const isFalseCall = (ai_decision === 'PASS' && operator_decision === 'NG') ||
                        (ai_decision === 'FAIL' && operator_decision === 'GOOD')

    // Call atomic RPC function
    const { data, error } = await supabase.rpc('submit_inspection_atomic', {
      p_inspection_id: inspection_id,
      p_work_order_id: work_order_id,
      p_operator_decision: operator_decision,
      p_ai_decision: ai_decision,
      p_side: side,
      p_is_false_call: isFalseCall,
      p_false_call_reason_id: false_call_reason_id || null,
      p_comment: comment || null,
      p_image_url: image_url || null,
      p_detections: detections ? JSON.stringify(detections) : null,
      p_operator_id: request.user?.id || null
    })

    if (error) {
      console.error('submit_inspection_atomic error:', error)

      // Check for specific error types
      if (error.message.includes('Work order not found')) {
        return NextResponse.json({
          success: false,
          error: 'Work order not found'
        }, { status: 404 })
      }

      if (error.message.includes('not active')) {
        return NextResponse.json({
          success: false,
          error: 'Work order is not active'
        }, { status: 400 })
      }

      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        inspection_id: data.inspection_id,
        work_order_id,
        decision: operator_decision,
        is_false_call: isFalseCall,
        next_action: data.next_action, // 'FLIP' or 'NEXT_PCB' or 'COMPLETED'
        counters: data.counters
      }
    })
  } catch (error) {
    console.error('POST /api/inspections/submit error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export const POST = withAuth('inspection:create')(handlePOST)

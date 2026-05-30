# Phase 13: Work Order Flow Hardening

## Objective
Create atomic server-side transactions for Work Order operations to prevent data inconsistency.

---

## Context

Current implementation has client-side logic that can lead to race conditions:
- Counter updates not atomic
- Side switching logic in client
- No rollback on partial failures

Need to move critical operations to server with transactions.

---

## Task 1: Atomic Inspection Submit Endpoint

### 1.1 `app/api/inspections/submit/route.js`

```javascript
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
  inspection_id: z.string(),
  work_order_id: z.string().uuid(),
  operator_decision: z.enum(['GOOD', 'NG']),
  ai_decision: z.enum(['PASS', 'FAIL']),
  side: z.enum(['top', 'bottom']),
  false_call_reason_id: z.string().uuid().optional(),
  comment: z.string().optional()
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
      comment
    } = validation.data

    // Determine if this is a false call
    const isFalseCall = (ai_decision === 'PASS' && operator_decision === 'NG') ||
                        (ai_decision === 'FAIL' && operator_decision === 'GOOD')

    // Start transaction using RPC
    const { data, error } = await supabase.rpc('submit_inspection_atomic', {
      p_inspection_id: inspection_id,
      p_work_order_id: work_order_id,
      p_operator_decision: operator_decision,
      p_ai_decision: ai_decision,
      p_side: side,
      p_is_false_call: isFalseCall,
      p_false_call_reason_id: false_call_reason_id,
      p_comment: comment,
      p_operator_id: request.user.id
    })

    if (error) {
      console.error('submit_inspection_atomic error:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        inspection_id,
        work_order_id,
        decision: operator_decision,
        is_false_call: isFalseCall,
        next_action: data.next_action // 'FLIP' or 'NEXT_PCB' or 'COMPLETED'
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
```

---

## Task 2: Database Function for Atomic Submit

### 2.1 SQL Function: `submit_inspection_atomic`

```sql
-- .claude/sql/025-submit-inspection-atomic.sql

CREATE OR REPLACE FUNCTION submit_inspection_atomic(
  p_inspection_id TEXT,
  p_work_order_id UUID,
  p_operator_decision TEXT,
  p_ai_decision TEXT,
  p_side TEXT,
  p_is_false_call BOOLEAN,
  p_false_call_reason_id UUID DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_work_order RECORD;
  v_next_action TEXT;
  v_inspection_id UUID;
BEGIN
  -- Lock work order row
  SELECT * INTO v_work_order
  FROM work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF v_work_order.status != 'active' THEN
    RAISE EXCEPTION 'Work order is not active';
  END IF;

  -- Insert inspection record
  INSERT INTO inspections (
    external_inspection_id,
    work_order_id,
    operator_id,
    ai_decision,
    operator_decision,
    side,
    is_false_call,
    false_call_reason_id,
    comment,
    inspected_at
  ) VALUES (
    p_inspection_id,
    p_work_order_id,
    p_operator_id,
    p_ai_decision,
    p_operator_decision,
    p_side,
    p_is_false_call,
    p_false_call_reason_id,
    p_comment,
    NOW()
  )
  RETURNING id INTO v_inspection_id;

  -- Update work order counters
  IF p_operator_decision = 'GOOD' THEN
    UPDATE work_orders
    SET
      inspected_good = inspected_good + 1,
      updated_at = NOW()
    WHERE id = p_work_order_id;
  ELSE
    UPDATE work_orders
    SET
      inspected_ng = inspected_ng + 1,
      updated_at = NOW()
    WHERE id = p_work_order_id;
  END IF;

  -- Determine next action
  IF p_side = 'top' AND v_work_order.board_sides = 2 THEN
    v_next_action := 'FLIP';
  ELSIF v_work_order.inspected_good + v_work_order.inspected_ng >= v_work_order.lot_size THEN
    -- Work order complete
    UPDATE work_orders
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_work_order_id;
    v_next_action := 'COMPLETED';
  ELSE
    v_next_action := 'NEXT_PCB';
  END IF;

  -- Log event
  INSERT INTO event_log (
    event_type,
    entity_type,
    entity_id,
    user_id,
    metadata
  ) VALUES (
    'inspection_submitted',
    'inspection',
    v_inspection_id,
    p_operator_id,
    jsonb_build_object(
      'work_order_id', p_work_order_id,
      'decision', p_operator_decision,
      'is_false_call', p_is_false_call
    )
  );

  -- If false call, add to sync queue
  IF p_is_false_call THEN
    INSERT INTO sync_queue (
      entity_type,
      entity_id,
      action,
      status
    ) VALUES (
      'inspection',
      v_inspection_id,
      'sync_false_call',
      'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'inspection_id', v_inspection_id,
    'next_action', v_next_action
  );
END;
$$ LANGUAGE plpgsql;
```

---

## Task 3: Side Logic Server Endpoint

### 3.1 `app/api/work-orders/[id]/next-side/route.js`

```javascript
/**
 * Next Side Logic
 * Determines what happens after current side inspection
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { supabase } from '@/lib/supabaseClient'

async function handlePOST(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { current_side } = body

    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !wo) {
      return NextResponse.json({
        success: false,
        error: 'Work order not found'
      }, { status: 404 })
    }

    let nextAction, nextSide

    if (current_side === 'top' && wo.board_sides === 2) {
      nextAction = 'FLIP'
      nextSide = 'bottom'
    } else if (current_side === 'bottom' || wo.board_sides === 1) {
      nextAction = 'NEXT_PCB'
      nextSide = 'top'
    }

    // Check if WO should complete
    const totalInspected = wo.inspected_good + wo.inspected_ng
    if (totalInspected >= wo.lot_size) {
      nextAction = 'COMPLETED'
    }

    return NextResponse.json({
      success: true,
      data: {
        next_action: nextAction,
        next_side: nextSide,
        progress: {
          inspected: totalInspected,
          lot_size: wo.lot_size,
          yield: totalInspected > 0
            ? ((wo.inspected_good / totalInspected) * 100).toFixed(1)
            : 0
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

export const POST = withAuth('work-orders:update')(handlePOST)
```

---

## Task 4: Real-time WO Counter Broadcast

### 4.1 Update SSE to Include WO Updates

Add to live inspection SSE:

```javascript
// Broadcast WO counter updates
eventSource.addEventListener('work_order_update', (e) => {
  const data = JSON.parse(e.data)
  setWorkOrderCounters(data)
})
```

---

## Verification Checklist

- [ ] `POST /api/inspections/submit` created
- [ ] SQL function `submit_inspection_atomic` deployed
- [ ] Transaction handles all steps atomically
- [ ] Rollback on any failure
- [ ] `POST /api/work-orders/[id]/next-side` created
- [ ] Side logic moved to server
- [ ] WO counter updates broadcast via SSE
- [ ] Event log entries created
- [ ] Sync queue updated for false calls

---

## Testing Scenarios

1. **Happy Path**: Submit inspection, counters update, next action returned
2. **Race Condition**: Multiple operators submit simultaneously
3. **WO Completion**: Auto-complete when lot size reached
4. **False Call**: Sync queue entry created
5. **Rollback**: Database error mid-transaction

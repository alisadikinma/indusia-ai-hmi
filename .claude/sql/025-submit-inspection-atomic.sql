-- =============================================
-- Atomic Inspection Submit Function
-- Phase 13: Work Order Flow Hardening
-- =============================================
-- This function handles all inspection submission logic atomically:
-- 1. Validates work order state
-- 2. Inserts inspection record
-- 3. Updates work order counters
-- 4. Determines next action (FLIP/NEXT_PCB/COMPLETED)
-- 5. Logs event
-- 6. Adds to sync queue for false calls
-- =============================================

CREATE OR REPLACE FUNCTION submit_inspection_atomic(
  p_inspection_id TEXT,
  p_work_order_id UUID,
  p_operator_decision TEXT,
  p_ai_decision TEXT,
  p_side TEXT,
  p_is_false_call BOOLEAN,
  p_false_call_reason_id UUID DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_detections JSONB DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_work_order RECORD;
  v_next_action TEXT;
  v_inspection_uuid UUID;
  v_total_inspected INTEGER;
  v_new_good INTEGER;
  v_new_ng INTEGER;
BEGIN
  -- Lock work order row to prevent race conditions
  SELECT * INTO v_work_order
  FROM work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF v_work_order.status != 'active' THEN
    RAISE EXCEPTION 'Work order is not active (current status: %)', v_work_order.status;
  END IF;

  -- Generate UUID for inspection
  v_inspection_uuid := gen_random_uuid();

  -- Insert inspection record
  INSERT INTO inspections (
    id,
    external_inspection_id,
    work_order_id,
    operator_id,
    ai_decision,
    operator_decision,
    side,
    is_false_call,
    false_call_reason_id,
    comment,
    image_url,
    detections,
    inspected_at,
    created_at
  ) VALUES (
    v_inspection_uuid,
    p_inspection_id,
    p_work_order_id,
    p_operator_id,
    p_ai_decision,
    p_operator_decision,
    p_side,
    p_is_false_call,
    p_false_call_reason_id,
    p_comment,
    p_image_url,
    p_detections,
    NOW(),
    NOW()
  );

  -- Update work order counters based on decision
  IF p_operator_decision = 'GOOD' THEN
    UPDATE work_orders
    SET
      inspected_good = inspected_good + 1,
      updated_at = NOW()
    WHERE id = p_work_order_id
    RETURNING inspected_good, inspected_ng INTO v_new_good, v_new_ng;
  ELSE
    UPDATE work_orders
    SET
      inspected_ng = inspected_ng + 1,
      updated_at = NOW()
    WHERE id = p_work_order_id
    RETURNING inspected_good, inspected_ng INTO v_new_good, v_new_ng;
  END IF;

  -- Calculate total inspected
  v_total_inspected := v_new_good + v_new_ng;

  -- Determine next action based on side and progress
  IF p_side = 'top' AND v_work_order.board_sides = 2 THEN
    -- Two-sided board, just finished top -> need to flip
    v_next_action := 'FLIP';
  ELSIF v_total_inspected >= v_work_order.lot_size THEN
    -- Lot complete
    UPDATE work_orders
    SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_work_order_id;

    v_next_action := 'COMPLETED';
  ELSE
    -- Move to next PCB
    v_next_action := 'NEXT_PCB';
  END IF;

  -- Log event
  INSERT INTO event_log (
    id,
    event_type,
    entity_type,
    entity_id,
    user_id,
    metadata,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'inspection_submitted',
    'inspection',
    v_inspection_uuid,
    p_operator_id,
    jsonb_build_object(
      'work_order_id', p_work_order_id,
      'external_inspection_id', p_inspection_id,
      'decision', p_operator_decision,
      'ai_decision', p_ai_decision,
      'is_false_call', p_is_false_call,
      'side', p_side,
      'next_action', v_next_action
    ),
    NOW()
  );

  -- If false call, add to sync queue for training data
  IF p_is_false_call THEN
    INSERT INTO sync_queue (
      id,
      entity_type,
      entity_id,
      action,
      status,
      priority,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'inspection',
      v_inspection_uuid,
      'sync_false_call',
      'pending',
      1,
      NOW()
    );
  END IF;

  -- Return result with next action and updated counters
  RETURN jsonb_build_object(
    'inspection_id', v_inspection_uuid,
    'next_action', v_next_action,
    'counters', jsonb_build_object(
      'inspected_good', v_new_good,
      'inspected_ng', v_new_ng,
      'total', v_total_inspected,
      'lot_size', v_work_order.lot_size,
      'yield_percent', CASE
        WHEN v_total_inspected > 0
        THEN ROUND((v_new_good::NUMERIC / v_total_inspected) * 100, 1)
        ELSE 0
      END
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_inspection_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION submit_inspection_atomic TO service_role;

-- Add comment
COMMENT ON FUNCTION submit_inspection_atomic IS
'Atomic inspection submission with work order counter updates, event logging, and sync queue management';

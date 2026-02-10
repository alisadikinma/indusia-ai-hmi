import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/inspection/stats/[lineId]
 * Get inspection statistics for a specific line
 * 
 * Priority:
 * 1. If active Work Order exists → use WO stats
 * 2. Fallback to inspection_results table
 * 
 * Query params:
 * - shift: 'day' | 'swing' | 'night' | 'all' (default: current shift)
 * - date: ISO date string (default: today)
 * - useWO: 'true' | 'false' (default: true) - prefer work order stats
 */
export async function GET(request, { params }) {
  try {
    const { lineId } = params;
    const { searchParams } = new URL(request.url);
    
    const shiftParam = searchParams.get('shift');
    const dateParam = searchParams.get('date');
    const useWO = searchParams.get('useWO') !== 'false';
    
    // Calculate current shift
    const getCurrentShift = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 14) return 'day';
      if (hour >= 14 && hour < 22) return 'swing';
      return 'night';
    };
    
    const shift = shiftParam || getCurrentShift();
    
    // Calculate date range
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // ============ Try Work Order First ============
    if (useWO) {
      // Use .order().limit(1) instead of .single() to handle edge case
      // where multiple active WOs exist for the same line
      const { data: activeWOs, error: woError } = await supabase
        .from('work_orders')
        .select(`
          id,
          wo_number,
          lot_size,
          side_count,
          completed_qty,
          good_qty,
          ng_qty,
          false_call_qty,
          status
        `)
        .eq('line_id', lineId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      const activeWO = activeWOs?.[0];
      if (!woError && activeWO) {
        // Calculate yield from WO
        const yieldPct = activeWO.completed_qty > 0 
          ? ((activeWO.good_qty / activeWO.completed_qty) * 100).toFixed(1)
          : '100.0';
        
        // Next board sequence
        const nextBoardNumber = activeWO.completed_qty + 1;
        
        return NextResponse.json({
          success: true,
          data: {
            lineId,
            shift,
            date: targetDate.toISOString().split('T')[0],
            source: 'work_order',
            workOrder: {
              id: activeWO.id,
              woNumber: activeWO.wo_number,
              lotSize: activeWO.lot_size,
              sideCount: activeWO.side_count,
              completedQty: activeWO.completed_qty,
            },
            stats: {
              passed: activeWO.good_qty,
              failed: activeWO.ng_qty,
              falseCall: activeWO.false_call_qty,
              total: activeWO.completed_qty,
              yield: yieldPct,
            },
            nextBoardNumber,
            lastBoardId: activeWO.completed_qty > 0 
              ? `${activeWO.wo_number}-${String(activeWO.completed_qty).padStart(4, '0')}`
              : null,
          }
        });
      }
    }
    
    // ============ Fallback to inspection_results ============
    let query = supabase
      .from('inspection_results')
      .select('id, operator_decision, ai_result, created_at, shift')
      .eq('line_id', lineId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());
    
    if (shift !== 'all') {
      query = query.eq('shift', shift);
    }
    
    const { data: inspections, error } = await query;
    
    if (error) {
      console.error('Error fetching inspection stats:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    // Calculate stats
    const stats = {
      passed: 0,
      failed: 0,
      falseCall: 0,
      total: inspections?.length || 0,
    };
    
    if (inspections) {
      for (const insp of inspections) {
        switch (insp.operator_decision) {
          case 'APPROVE':
            // Need to check if AI said GOOD or NG
            if (insp.ai_result === 'NG' || insp.ai_result === 'FAIL') {
              stats.failed++; // Confirmed NG
            } else {
              stats.passed++; // Confirmed GOOD
            }
            break;
          case 'REJECT':
            stats.failed++;
            break;
          case 'FALSE_CALL':
            stats.passed++; // Board passed (AI was wrong)
            stats.falseCall++;
            break;
          default:
            // AI auto-pass (no operator decision)
            if (insp.ai_result === 'PASS' || insp.ai_result === 'GOOD') {
              stats.passed++;
            }
        }
      }
    }
    
    // Calculate yield
    const totalInspected = stats.passed + stats.failed;
    stats.yield = totalInspected > 0 
      ? ((stats.passed / totalInspected) * 100).toFixed(1)
      : '100.0';
    
    // Get last board number
    const { data: lastInspection } = await supabase
      .from('inspection_results')
      .select('board_id')
      .eq('line_id', lineId)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let nextBoardNumber = 1;
    if (lastInspection?.board_id) {
      const match = lastInspection.board_id.match(/(\d+)$/);
      if (match) {
        nextBoardNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        lineId,
        shift,
        date: targetDate.toISOString().split('T')[0],
        source: 'inspection_results',
        workOrder: null,
        stats,
        nextBoardNumber,
        lastBoardId: lastInspection?.board_id || null,
      }
    });
    
  } catch (error) {
    console.error('Inspection stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

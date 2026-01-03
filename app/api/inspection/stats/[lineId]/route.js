import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/inspection/stats/[lineId]
 * Get inspection statistics for a specific line
 * 
 * Query params:
 * - shift: 'day' | 'swing' | 'night' | 'all' (default: current shift)
 * - date: ISO date string (default: today)
 */
export async function GET(request, { params }) {
  try {
    const { lineId } = params;
    const { searchParams } = new URL(request.url);
    
    // Get shift filter
    const shiftParam = searchParams.get('shift');
    const dateParam = searchParams.get('date');
    
    // Calculate current shift if not provided
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
    
    // Build query
    let query = supabase
      .from('inspection_results')
      .select('id, operator_decision, ai_result, created_at, shift')
      .eq('line_id', lineId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());
    
    // Filter by shift if not 'all'
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
            stats.passed++;
            break;
          case 'REJECT':
            stats.failed++;
            break;
          case 'FALSE_CALL':
            stats.passed++; // Board passed
            stats.falseCall++;
            break;
          default:
            // AI auto-pass (no operator decision needed)
            if (insp.ai_result === 'PASS') {
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
    
    // Get last board number for this line today
    const { data: lastInspection } = await supabase
      .from('inspection_results')
      .select('board_id')
      .eq('line_id', lineId)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Extract board number or generate new sequence
    let nextBoardNumber = 1;
    if (lastInspection?.board_id) {
      // Try to extract number from format like "PCB-2024-0847"
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

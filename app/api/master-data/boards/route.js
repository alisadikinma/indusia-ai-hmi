import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/boards
 * Query params: customer_id
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('boards')
      .select(`
        id,
        name,
        customer_id,
        cavity_count,
        top_frame_count,
        bottom_frame_count,
        customers:customer_id (id, name, code)
      `)
      .order('name');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to camelCase
    const transformed = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      customerId: item.customer_id,
      cavityCount: item.cavity_count || 1,
      topFrameCount: item.top_frame_count || 1,
      bottomFrameCount: item.bottom_frame_count || 0,
      customer: item.customers ? {
        id: item.customers.id,
        name: item.customers.name,
        code: item.customers.code,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: transformed,
      total: transformed.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-data/boards
 * Create new board
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Board name is required' },
        { status: 400 }
      );
    }

    // Accept both camelCase and snake_case
    const customerId = body.customerId || body.customer_id;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    const boardId = body.id || `board_${Date.now()}`;

    const cavityCount = body.cavityCount || body.cavity_count || 1;
    const topFrameCount = body.topFrameCount ?? body.top_frame_count ?? 1;
    const bottomFrameCount = body.bottomFrameCount ?? body.bottom_frame_count ?? 0;

    const { data, error } = await supabase
      .from('boards')
      .insert({
        id: boardId,
        name: body.name.trim(),
        customer_id: customerId,
        cavity_count: cavityCount,
        top_frame_count: topFrameCount,
        bottom_frame_count: bottomFrameCount,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        customerId: data.customer_id,
        cavityCount: data.cavity_count || 1,
        topFrameCount: data.top_frame_count || 1,
        bottomFrameCount: data.bottom_frame_count || 0,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

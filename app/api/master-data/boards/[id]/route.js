import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/boards/[id]
 * Get single board by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Board not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Transform to camelCase
    const transformed = {
      id: data.id,
      name: data.name,
      customerId: data.customer_id,
      cavityCount: data.cavity_count || 1,
      topFrameCount: data.top_frame_count || 1,
      bottomFrameCount: data.bottom_frame_count || 0,
      customer: data.customers ? {
        id: data.customers.id,
        name: data.customers.name,
        code: data.customers.code,
      } : null,
    };

    return NextResponse.json({
      success: true,
      data: transformed
    });

  } catch (error) {
    console.error('Error fetching board:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-data/boards/[id]
 * Update board
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;

    // Accept both camelCase and snake_case
    const customerId = body.customerId || body.customer_id;
    if (customerId !== undefined) updateData.customer_id = customerId;

    const cavityCount = body.cavityCount ?? body.cavity_count;
    if (cavityCount !== undefined) updateData.cavity_count = cavityCount;

    const topFrameCount = body.topFrameCount ?? body.top_frame_count;
    if (topFrameCount !== undefined) updateData.top_frame_count = topFrameCount;

    const bottomFrameCount = body.bottomFrameCount ?? body.bottom_frame_count;
    if (bottomFrameCount !== undefined) updateData.bottom_frame_count = bottomFrameCount;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('boards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Board not found' },
          { status: 404 }
        );
      }
      throw error;
    }

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
    });

  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-data/boards/[id]
 * Delete board (checks for dependencies first)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check for dependent work orders
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('id')
      .eq('board_id', id)
      .limit(1);

    if (workOrders && workOrders.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Board has associated work orders.' },
        { status: 400 }
      );
    }

    // Safe to delete
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Board deleted'
    });

  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

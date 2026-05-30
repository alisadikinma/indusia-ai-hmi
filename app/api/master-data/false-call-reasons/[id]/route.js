/**
 * False Call Reasons [id] API Route
 * GET /api/master-data/false-call-reasons/[id]
 * PATCH /api/master-data/false-call-reasons/[id]
 * DELETE /api/master-data/false-call-reasons/[id]
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET - Get single reason by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Reason not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error fetching reason:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update reason
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.code !== undefined) updateData.code = body.code.trim().toUpperCase();
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('false_call_reasons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error updating reason:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete reason
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check if reason is used in inspection_results
    const { data: usageCheck } = await supabase
      .from('inspection_results')
      .select('id')
      .eq('false_call_reason_id', id)
      .limit(1);

    if (usageCheck && usageCheck.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Reason is used in inspection records' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('false_call_reasons')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Reason deleted' });

  } catch (error) {
    console.error('Error deleting reason:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

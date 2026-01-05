import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/customers/[id]
 * Get single customer by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, code')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-data/customers/[id]
 * Update customer
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-data/customers/[id]
 * Delete customer (checks for dependencies first)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check for dependent boards
    const { data: boards } = await supabase
      .from('boards')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (boards && boards.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Customer has associated boards. Delete boards first.' },
        { status: 400 }
      );
    }

    // Check for dependent lines
    const { data: lines } = await supabase
      .from('lines')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (lines && lines.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Customer has associated lines. Delete lines first.' },
        { status: 400 }
      );
    }

    // Check for dependent work orders
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (workOrders && workOrders.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Customer has associated work orders.' },
        { status: 400 }
      );
    }

    // Safe to delete
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted'
    });

  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

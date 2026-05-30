import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/lines/[id]
 * Get single line by ID with related data
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('lines')
      .select(`
        id,
        name,
        section_id,
        customer_id,
        sections:section_id (id, name),
        customers:customer_id (id, name, code, logo_base64)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Line not found' },
          { status: 404 }
        );
      }
      console.error('Supabase error:', error);
      throw error;
    }

    // Transform to camelCase
    const transformed = {
      id: data.id,
      name: data.name,
      sectionId: data.section_id,
      customerId: data.customer_id,
      section: data.sections ? {
        id: data.sections.id,
        name: data.sections.name,
      } : null,
      customer: data.customers ? {
        id: data.customers.id,
        name: data.customers.name,
        code: data.customers.code,
        logoBase64: data.customers.logo_base64 || null,
      } : null,
    };

    return NextResponse.json({
      success: true,
      data: transformed
    });

  } catch (error) {
    console.error('Error fetching line:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-data/lines/[id]
 * Update line
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    
    // Accept both camelCase and snake_case
    const sectionId = body.sectionId || body.section_id;
    const customerId = body.customerId || body.customer_id;
    
    if (sectionId !== undefined) updateData.section_id = sectionId;
    if (customerId !== undefined) updateData.customer_id = customerId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('lines')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Line not found' },
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
        sectionId: data.section_id,
        customerId: data.customer_id,
      }
    });

  } catch (error) {
    console.error('Error updating line:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-data/lines/[id]
 * Delete line (checks for dependencies first)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check for dependent work orders
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('id')
      .eq('line_id', id)
      .limit(1);

    if (workOrders && workOrders.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Line has associated work orders.' },
        { status: 400 }
      );
    }

    // Safe to delete
    const { error } = await supabase
      .from('lines')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Line deleted'
    });

  } catch (error) {
    console.error('Error deleting line:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

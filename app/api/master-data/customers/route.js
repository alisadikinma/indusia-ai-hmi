import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/customers
 * Returns all customers
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, code')
      .order('name');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-data/customers
 * Create new customer
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    const customerId = body.id || `cust_${Date.now()}`;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        id: customerId,
        name: body.name.trim(),
        code: body.code || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

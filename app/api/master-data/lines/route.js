import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/lines
 * Query params: section_id, customer_id
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('lines')
      .select(`
        id, 
        name, 
        section_id,
        customer_id,
        sections:section_id (id, name),
        customers:customer_id (id, name, code)
      `)
      .order('name');

    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to camelCase
    const transformed = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      sectionId: item.section_id,
      customerId: item.customer_id,
      section: item.sections ? {
        id: item.sections.id,
        name: item.sections.name,
      } : null,
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
 * POST /api/master-data/lines
 * Create new line
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Line name is required' },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    const lineId = body.id || `line_${Date.now()}`;

    const insertData = {
      id: lineId,
      name: body.name.trim(),
    };

    // Accept both camelCase and snake_case
    const sectionId = body.sectionId || body.section_id;
    const customerId = body.customerId || body.customer_id;

    if (sectionId) insertData.section_id = sectionId;
    if (customerId) insertData.customer_id = customerId;

    const { data, error } = await supabase
      .from('lines')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        sectionId: data.section_id,
        customerId: data.customer_id
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating line:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

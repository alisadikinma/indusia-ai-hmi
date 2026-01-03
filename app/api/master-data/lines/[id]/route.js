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
        customers:customer_id (id, name, code)
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

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/sections
 * Returns all sections
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sections')
      .select('id, name')
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
 * POST /api/master-data/sections
 * Create new section
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Section name is required' },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    const sectionId = body.id || `section_${Date.now()}`;

    const { data, error } = await supabase
      .from('sections')
      .insert({
        id: sectionId,
        name: body.name.trim()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating section:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

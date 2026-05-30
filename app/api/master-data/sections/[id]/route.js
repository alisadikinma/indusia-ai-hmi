import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/sections/[id]
 * Get single section by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('sections')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Section not found' },
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
    console.error('Error fetching section:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-data/sections/[id]
 * Update section
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('sections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Section not found' },
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
    console.error('Error updating section:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-data/sections/[id]
 * Delete section (checks for dependencies first)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check for dependent lines
    const { data: lines } = await supabase
      .from('lines')
      .select('id')
      .eq('section_id', id)
      .limit(1);

    if (lines && lines.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete: Section has associated lines. Delete lines first.' },
        { status: 400 }
      );
    }

    // Safe to delete
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Section deleted'
    });

  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

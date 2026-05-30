/**
 * False Call Reasons API Route
 * GET /api/master-data/false-call-reasons - List all reasons
 * POST /api/master-data/false-call-reasons - Create new reason
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/master-data/false-call-reasons
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('false_call_reasons')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Error fetching false call reasons:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-data/false-call-reasons
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.code?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Let Supabase auto-generate UUID for id
    const insertData = {
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      is_active: body.is_active !== false,
      display_order: body.display_order || 0
    };

    const { data, error } = await supabase
      .from('false_call_reasons')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });

  } catch (error) {
    console.error('Error creating false call reason:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

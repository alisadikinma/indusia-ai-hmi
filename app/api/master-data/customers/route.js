import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth/apiAuth';

/**
 * GET /api/master-data/customers
 * Returns all customers
 */
async function handleGET() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, code, logo_base64')
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
async function handlePOST(request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Generate secure ID if not provided
    const customerId = body.id || `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Validate name length
    if (body.name.trim().length > 200) {
      return NextResponse.json(
        { success: false, error: 'Customer name must be 200 characters or less.' },
        { status: 400 }
      );
    }

    // Validate logo_base64 if provided
    if (body.logo_base64) {
      // Block SVG (XSS risk) — only allow raster formats
      const allowedPrefixes = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/gif', 'data:image/webp'];
      const isAllowed = allowedPrefixes.some(p => body.logo_base64.startsWith(p));
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: 'Invalid image format. Only PNG, JPG, GIF, and WebP are allowed.' },
          { status: 400 }
        );
      }
      // ~300KB base64 limit (200KB image ≈ 270KB base64)
      if (body.logo_base64.length > 400000) {
        return NextResponse.json(
          { success: false, error: 'Logo too large. Maximum size is 200KB.' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        id: customerId,
        name: body.name.trim(),
        code: body.code || null,
        logo_base64: body.logo_base64 || null,
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

export const GET = withAuth()(handleGET)
export const POST = withAuth('master-data:create')(handlePOST)

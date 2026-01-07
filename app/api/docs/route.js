/**
 * Swagger UI Documentation Route
 * GET /api/docs - Redirects to static Swagger UI page
 */

import { NextResponse } from 'next/server'

export async function GET(request) {
  const url = new URL('/docs/', request.url)
  return NextResponse.redirect(url)
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { withAuth, withOptionalAuth } from '@/lib/auth/apiAuth'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'
import { z } from 'zod'

// Validation schema for error logs
const errorLogSchema = z.object({
  error: z.string().max(10000).optional(),
  message: z.string().max(10000).optional(),
  stack: z.string().max(50000).optional(),
  componentStack: z.string().max(50000).optional(),
  source: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  additionalInfo: z.any().optional(),
  timestamp: z.string().datetime().optional()
}).refine(data => data.error || data.message, {
  message: 'Either error or message is required'
})

/**
 * POST /api/error-log
 * Log client-side errors to the database
 * Uses optional auth - allows logging even if not authenticated
 * (errors can occur during login, etc.)
 */
async function handlePOST(request) {
  try {
    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody, { maxStringLength: 50000 })

    // Validate input
    const validation = errorLogSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid error log format' },
        { status: 400 }
      )
    }

    const errorData = validation.data

    // Prepare event log entry
    const eventLogEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: errorData.timestamp || new Date().toISOString(),
      type: errorData.source === 'ErrorBoundary' ? 'CLIENT_ERROR' : 'ERROR',
      source: errorData.source || 'HMI',
      severity: determineSeverity(errorData),
      details: {
        error: errorData.error || errorData.message,
        stack: errorData.stack || null,
        componentStack: errorData.componentStack || null,
        url: errorData.url || null,
        userAgent: errorData.userAgent || null,
        userId: request.user?.id || null, // From auth, not from body
        additionalInfo: errorData.additionalInfo || null
      }
    }

    // Log to database
    const { error: dbError } = await supabase
      .from('event_log')
      .insert(eventLogEntry)

    if (dbError) {
      console.error('[Error Log API] Failed to insert to database:', dbError)

      return NextResponse.json({
        success: true,
        logged: false,
        fallback: 'console'
      })
    }

    return NextResponse.json({
      success: true,
      logged: true,
      id: eventLogEntry.id
    })

  } catch (error) {
    console.error('[Error Log API] Exception:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error log',
        logged: false
      },
      { status: 500 }
    )
  }
}

/**
 * Determine error severity based on error data
 */
function determineSeverity(errorData) {
  const errorMessage = (errorData.error || errorData.message || '').toLowerCase()

  if (
    errorMessage.includes('uncaught') ||
    errorMessage.includes('fatal') ||
    errorMessage.includes('crash') ||
    errorData.source === 'ErrorBoundary'
  ) {
    return 'CRITICAL'
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('auth')
  ) {
    return 'ERROR'
  }

  return 'WARNING'
}

/**
 * GET /api/error-log
 * Retrieve error logs (admin only)
 * Requires logs:read permission
 */
async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const since = searchParams.get('since')

    let query = supabase
      .from('event_log')
      .select('*', { count: 'exact' })
      .in('type', ['CLIENT_ERROR', 'ERROR', 'SYSTEM_ERROR'])
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (since) {
      query = query.gte('timestamp', since)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Error Log API] Query failed:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch error logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: count,
        limit,
        offset
      }
    })

  } catch (error) {
    console.error('[Error Log API] GET Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Optional auth (errors can occur before login)
export const POST = withOptionalAuth(handlePOST)
// GET: Requires logs:read permission (admin only)
export const GET = withAuth('logs:read')(handleGET)

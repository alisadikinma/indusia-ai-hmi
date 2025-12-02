import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

/**
 * POST /api/error-log
 * Log client-side errors to the database
 */
export async function POST(request) {
  try {
    const errorData = await request.json()

    // Validate required fields
    if (!errorData.error && !errorData.message) {
      return NextResponse.json(
        { success: false, error: 'Error message is required' },
        { status: 400 }
      )
    }

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
        userId: errorData.userId || null,
        additionalInfo: errorData.additionalInfo || null
      }
    }

    // Log to database
    const { error: dbError } = await supabase
      .from('event_log')
      .insert(eventLogEntry)

    if (dbError) {
      // Log to console as fallback
      console.error('[Error Log API] Failed to insert to database:', dbError)
      console.error('[Error Log API] Error data:', eventLogEntry)

      // Still return success to client - we don't want error logging to fail
      return NextResponse.json({
        success: true,
        logged: false,
        fallback: 'console'
      })
    }

    // In production, you might also want to:
    // 1. Send to external error tracking service (Sentry, Bugsnag, etc.)
    // 2. Send alerts for critical errors
    // 3. Aggregate similar errors

    return NextResponse.json({
      success: true,
      logged: true,
      id: eventLogEntry.id
    })

  } catch (error) {
    // Even if parsing fails, log what we can
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

  // Critical errors
  if (
    errorMessage.includes('uncaught') ||
    errorMessage.includes('fatal') ||
    errorMessage.includes('crash') ||
    errorData.source === 'ErrorBoundary'
  ) {
    return 'CRITICAL'
  }

  // High severity
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('auth')
  ) {
    return 'ERROR'
  }

  // Default to warning
  return 'WARNING'
}

/**
 * GET /api/error-log
 * Retrieve error logs (for admin/debugging purposes)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
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

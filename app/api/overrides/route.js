import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import { createOverrideSchema, overrideFiltersSchema, paginationSchema } from '@/lib/validations/schemas'
import { validate, validationErrorResponse, validateQueryParams } from '@/lib/validations/validate'
import { withAuth } from '@/lib/auth/apiAuth'
import { filterBySection, validateSectionAccess, getSectionFilter } from '@/lib/auth/sectionAccess'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'

/**
 * GET /api/overrides
 * Query params: status, section_id, customer_id, from, to, page, limit
 * Required permission: overrides:read
 * Section filtered: Users only see overrides from their assigned sections
 */
async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse and validate pagination params
    const paginationResult = validateQueryParams(paginationSchema, {
      page: searchParams.get('page'),
      limit: searchParams.get('limit')
    })

    const pagination = paginationResult.success
      ? paginationResult.data
      : { page: 1, limit: 20 }

    // Build filters
    const filters = {
      status: searchParams.get('status'),
      sectionId: searchParams.get('section_id'),
      customerId: searchParams.get('customer_id'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      page: pagination.page,
      limit: pagination.limit
    }

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined) delete filters[key]
    })

    // Apply section filter based on user's access
    const user = request.user
    const allowedSections = getSectionFilter(user)

    if (allowedSections !== null) {
      // User has restricted section access
      if (filters.sectionId) {
        // Verify user can access the requested section
        if (!allowedSections.includes(filters.sectionId)) {
          return NextResponse.json(
            { success: false, error: 'Access denied to requested section' },
            { status: 403 }
          )
        }
      } else {
        // Filter to user's sections
        filters.sectionIds = allowedSections
      }
    }

    const result = await overridesRepo.list(filters)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit
    })
  } catch (error) {
    console.error('[GET /api/overrides] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/overrides
 * Body: { board_id, defect_type, reason, operator_notes, operator_id, operator_name, section_id, customer_id }
 * Required permission: overrides:create
 * Section restricted: Can only create overrides for assigned sections
 */
async function handlePOST(request) {
  try {
    const body = await request.json()

    // Sanitize input
    const sanitizedBody = sanitizeRequestBody(body)

    // Validate input with Zod schema
    const validation = validate(createOverrideSchema, sanitizedBody)
    if (!validation.success) {
      return validationErrorResponse(validation.errors)
    }

    const data = validation.data

    // Validate section access
    try {
      validateSectionAccess(request.user, data.section_id)
    } catch (accessError) {
      return NextResponse.json(
        { success: false, error: accessError.message, code: accessError.code },
        { status: accessError.statusCode || 403 }
      )
    }

    // Create override
    const result = await overridesRepo.create(data)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/overrides] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization
export const GET = withAuth('overrides:read')(handleGET)
export const POST = withAuth('overrides:create')(handlePOST)

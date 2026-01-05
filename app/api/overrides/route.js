import { NextResponse } from 'next/server'
import * as overridesRepo from '@/lib/repos/overridesRepo'
import * as datasetQueueRepo from '@/lib/repos/datasetQueueRepo'
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
  console.log('[GET /api/overrides] Called')
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
    console.log('[GET /api/overrides] User:', user?.id, 'sections:', user?.sections)
    const allowedSections = getSectionFilter(user)
    console.log('[GET /api/overrides] allowedSections:', allowedSections)

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

    console.log('[GET /api/overrides] Final filters:', filters)
    const result = await overridesRepo.list(filters)
    console.log('[GET /api/overrides] Result:', result.data?.length, 'records, total:', result.total)

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
 * Enhanced: Also supports { override_type, images: [{ image_url, ai_detections, annotations }] }
 * Required permission: overrides:create
 * Section restricted: Can only create overrides for assigned sections
 */
async function handlePOST(request) {
  console.log('[POST /api/overrides] Handler called, user:', request.user?.id, 'role:', request.user?.role_id)
  try {
    const body = await request.json()
    console.log('[POST /api/overrides] Body received:', JSON.stringify(body).substring(0, 500))

    // Sanitize input
    const sanitizedBody = sanitizeRequestBody(body)

    // ============================================
    // Annotation-based override flow (has images array)
    // ============================================
    const hasAnnotations = Array.isArray(sanitizedBody.images) && sanitizedBody.images.length > 0
    console.log('[POST /api/overrides] hasAnnotations:', hasAnnotations)

    if (hasAnnotations) {
      // Annotation-based override flow
      const {
        board_id,
        section_id,
        line_id,
        customer_id,
        override_type,
        reason,
        correct_class,
        submitted_by,
        submitted_by_name,
        images
      } = sanitizedBody

      // Basic validation for annotation flow
      if (!board_id || !override_type || !reason) {
        return NextResponse.json(
          { success: false, error: 'board_id, override_type, and reason are required' },
          { status: 400 }
        )
      }

      // Validate section access if section_id provided
      if (section_id) {
        try {
          validateSectionAccess(request.user, section_id)
        } catch (accessError) {
          return NextResponse.json(
            { success: false, error: accessError.message, code: accessError.code },
            { status: accessError.statusCode || 403 }
          )
        }
      }

      // Create override with annotations
      const result = await overridesRepo.createWithAnnotation({
        board_id,
        section_id,
        line_id,
        customer_id,
        override_type,
        reason,
        correct_class,
        submitted_by: submitted_by || request.user?.id,
        submitted_by_name: submitted_by_name || request.user?.name,
        images
      })

      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      // Auto-queue for training based on override type
      if (result.data) {
        try {
          await datasetQueueRepo.autoQueueFromOverride({
            id: result.data.id,
            override_type
          })
        } catch (queueError) {
          // Log but don't fail the override creation
          console.error('[POST /api/overrides] Auto-queue error:', queueError)
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: result.data,
          imageError: result.imageError // Include if image insert had issues
        },
        { status: 201 }
      )
    }

    // Original flow - validate with schema
    console.log('[POST /api/overrides] Using original flow (no annotations)')
    const validation = validate(createOverrideSchema, sanitizedBody)
    if (!validation.success) {
      console.log('[POST /api/overrides] Validation failed:', validation.errors)
      return validationErrorResponse(validation.errors)
    }

    const data = validation.data
    console.log('[POST /api/overrides] Validated data:', data)

    // Validate section access (skip if section_id not provided - operator already logged in to line)
    if (data.section_id) {
      try {
        console.log('[POST /api/overrides] Checking section access for section_id:', data.section_id)
        validateSectionAccess(request.user, data.section_id)
        console.log('[POST /api/overrides] Section access OK')
      } catch (accessError) {
        // For operators creating from LiveView, skip strict section validation
        // They're already authenticated and working on an active line
        const isOperator = request.user?.role_id?.includes('operator')
        if (isOperator) {
          console.log('[POST /api/overrides] Section access skipped for operator (working on active line)')
        } else {
          console.log('[POST /api/overrides] Section access DENIED:', accessError.message)
          return NextResponse.json(
            { success: false, error: accessError.message, code: accessError.code },
            { status: accessError.statusCode || 403 }
          )
        }
      }
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

/**
 * AI Inspections API
 * POST: Create inspection from AI detection
 * GET: List inspections with filters
 * 
 * Using SELECT * to avoid column mismatch issues
 */

import { NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/apiKeyAuth'
import { supabase } from '@/lib/supabaseClient'
import { validate } from '@/lib/validations/validate'
import { z } from 'zod'

const createInspectionSchema = z.object({
  external_inspection_id: z.string().min(1),
  line_id: z.string(),
  board_id: z.string().optional(),
  ai_decision: z.enum(['PASS', 'FAIL']),
  ai_confidence: z.number().min(0).max(1).optional(),
  results: z.object({
    top: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }),
    bottom: z.object({
      image_url: z.string(),
      objects: z.array(z.any()).default([])
    }).optional()
  }).optional()
})

async function handlePOST(request) {
  try {
    const body = await request.json()
    const validation = validate(createInspectionSchema, body)

    if (!validation.success) {
      return NextResponse.json({ success: false, errors: validation.errors }, { status: 400 })
    }

    const data = validation.data
    const aiResult = data.ai_decision.toLowerCase()
    const imageUrl = data.results?.top?.image_url || data.results?.bottom?.image_url || null

    // Minimal insert - only columns that definitely exist
    const insertData = {
      line_id: data.line_id,
      board_id: data.board_id || null,
      ai_result: aiResult,
      ai_confidence: data.ai_confidence || null,
      image_url: imageUrl,
      operator_action: 'approve'
    }

    const { data: inspection, error } = await supabase
      .from('inspection_results')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('POST /api/ai/inspections error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: inspection.id,
        lineId: inspection.line_id,
        boardId: inspection.board_id,
        aiResult: inspection.ai_result?.toUpperCase(),
        aiConfidence: inspection.ai_confidence,
        createdAt: inspection.created_at
      }
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const lineId = searchParams.get('line_id')
    const aiDecision = searchParams.get('ai_decision')
    const isFalseCall = searchParams.get('is_false_call')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    // Use SELECT * to avoid column mismatch
    let query = supabase
      .from('inspection_results')
      .select('*', { count: 'exact' })

    if (lineId) query = query.eq('line_id', lineId)
    if (aiDecision) query = query.eq('ai_result', aiDecision.toLowerCase())
    if (isFalseCall === 'true') {
      query = query.eq('operator_action', 'false_call')
    } else if (isFalseCall === 'false') {
      query = query.neq('operator_action', 'false_call')
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('GET /api/ai/inspections error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Transform whatever columns exist
    const transformed = (data || []).map(row => {
      const result = { id: row.id }
      
      // Add fields if they exist
      if (row.board_id !== undefined) result.boardId = row.board_id
      if (row.line_id !== undefined) result.lineId = row.line_id
      if (row.section_id !== undefined) result.sectionId = row.section_id
      if (row.customer_id !== undefined) result.customerId = row.customer_id
      if (row.image_url !== undefined) result.imageUrl = row.image_url
      if (row.ai_result !== undefined) result.aiResult = row.ai_result?.toUpperCase()
      if (row.ai_confidence !== undefined) result.aiConfidence = row.ai_confidence
      if (row.operator_action !== undefined) result.operatorAction = row.operator_action
      if (row.operator_id !== undefined) result.operatorId = row.operator_id
      if (row.operator_notes !== undefined) result.operatorNotes = row.operator_notes
      if (row.auto_approved !== undefined) result.autoApproved = row.auto_approved
      if (row.created_at !== undefined) result.createdAt = row.created_at
      
      return result
    })

    return NextResponse.json({
      success: true,
      data: transformed,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('GET /api/ai/inspections error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePOST)
export const GET = withApiKeyAuth(handleGET)

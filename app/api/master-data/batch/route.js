/**
 * Batch Master Data API
 * GET /api/master-data/batch
 *
 * Returns all master data in a single request to avoid N parallel API calls.
 * Query params:
 *   include - comma-separated list (default: all)
 *     e.g. ?include=customers,sections,lines,boards,menuItems
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import * as masterDataRepo from '@/lib/repos/masterDataRepo'

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeParam = searchParams.get('include')
    const include = includeParam
      ? new Set(includeParam.split(',').map(s => s.trim()))
      : new Set(['customers', 'sections', 'lines', 'boards', 'menuItems'])

    // Run all requested queries in parallel — single auth check above
    const promises = {}

    if (include.has('customers')) {
      promises.customers = masterDataRepo.getCustomers()
    }
    if (include.has('sections')) {
      promises.sections = masterDataRepo.getSections()
    }
    if (include.has('lines')) {
      promises.lines = masterDataRepo.getLines()
    }
    if (include.has('boards')) {
      promises.boards = masterDataRepo.getBoards()
    }
    if (include.has('menuItems')) {
      promises.menuItems = masterDataRepo.getMenuItems()
    }

    const keys = Object.keys(promises)
    const results = await Promise.all(Object.values(promises))

    const data = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const result = results[i]
      data[key] = result.error ? [] : (result.data || [])
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[API] GET /master-data/batch error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withAuth()(handleGET)

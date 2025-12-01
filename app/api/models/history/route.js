import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

// Mock deployment history for development
const mockHistory = [
  {
    id: 'model-1',
    name: 'PCB Defect Detector',
    version: '2.1.0',
    deployed_at: '2024-11-28T10:00:00Z',
    deployed_by: 'u4',
    map50: 0.92,
    status: 'deployed',
    is_active: true
  },
  {
    id: 'model-2',
    name: 'PCB Defect Detector',
    version: '2.0.0',
    deployed_at: '2024-11-15T14:30:00Z',
    deployed_by: 'u4',
    map50: 0.88,
    status: 'ready',
    is_active: false
  },
  {
    id: 'model-old',
    name: 'PCB Defect Detector',
    version: '1.9.0',
    deployed_at: '2024-10-20T09:00:00Z',
    deployed_by: 'u4',
    map50: 0.85,
    status: 'deprecated',
    is_active: false
  }
]

/**
 * GET /api/models/history
 * Get deployment history
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    let history = await modelsRepo.getDeploymentHistory(limit)

    // Fallback to mock if empty
    if (!history || history.length === 0) {
      history = mockHistory.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('[GET /api/models/history] Error:', error)
    return NextResponse.json({
      success: true,
      data: mockHistory,
      _mock: true
    })
  }
}

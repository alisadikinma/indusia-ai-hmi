import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

// Mock model for development
const getMockModel = (id) => ({
  id,
  name: 'PCB Defect Detector',
  version: '2.1.0',
  description: 'YOLOv8 model trained on PCB defects',
  status: 'deployed',
  is_active: true,
  map50: 0.92,
  map50_95: 0.78,
  precision_val: 0.89,
  recall: 0.91,
  storage_path: 'models/pcb-v2.1.0.pt',
  public_url: null,
  deployed_at: '2024-11-28T10:00:00Z',
  deployed_by: 'u4',
  created_at: '2024-11-25T08:00:00Z',
  training_job_id: 'job-1'
})

/**
 * GET /api/models/:id
 * Get model details by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      )
    }

    let model = await modelsRepo.getModelById(id)

    // Fallback to mock if not found
    if (!model) {
      model = getMockModel(id)
    }

    return NextResponse.json({
      success: true,
      data: model
    })
  } catch (error) {
    console.error('[GET /api/models/:id] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch model' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/models/:id
 * Update model (status, etc.)
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Handle status update
    if (body.status) {
      const updated = await modelsRepo.updateModelStatus(id, body.status)
      if (updated) {
        return NextResponse.json({
          success: true,
          data: updated
        })
      }
    }

    // Mock response
    return NextResponse.json({
      success: true,
      data: { ...getMockModel(id), ...body },
      _mock: true
    })
  } catch (error) {
    console.error('[PATCH /api/models/:id] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update model' },
      { status: 500 }
    )
  }
}

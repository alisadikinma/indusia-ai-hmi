import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

// Mock active model for development
const mockActiveModel = {
  id: 'model-1',
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
  deployed_at: '2024-11-28T10:00:00Z',
  deployed_by: 'u4',
  created_at: '2024-11-25T08:00:00Z'
}

/**
 * GET /api/models/active
 * Get the currently active model
 */
export async function GET() {
  try {
    let activeModel = await modelsRepo.getActiveModel()

    // Fallback to mock if no active model
    if (!activeModel) {
      activeModel = mockActiveModel
    }

    return NextResponse.json({
      success: true,
      data: activeModel
    })
  } catch (error) {
    console.error('[GET /api/models/active] Error:', error)
    return NextResponse.json({
      success: true,
      data: mockActiveModel,
      _mock: true
    })
  }
}

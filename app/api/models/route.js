import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

// Mock data for development fallback
const mockModels = [
  {
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
    public_url: null,
    deployed_at: '2024-11-28T10:00:00Z',
    deployed_by: 'u4',
    created_at: '2024-11-25T08:00:00Z',
    training_job_id: 'job-1'
  },
  {
    id: 'model-2',
    name: 'PCB Defect Detector',
    version: '2.0.0',
    description: 'Previous production model',
    status: 'ready',
    is_active: false,
    map50: 0.88,
    map50_95: 0.72,
    precision_val: 0.85,
    recall: 0.87,
    storage_path: 'models/pcb-v2.0.0.pt',
    public_url: null,
    deployed_at: '2024-11-15T14:30:00Z',
    deployed_by: 'u4',
    created_at: '2024-11-10T09:00:00Z',
    training_job_id: 'job-2'
  },
  {
    id: 'model-3',
    name: 'PCB Defect Detector',
    version: '2.2.0-beta',
    description: 'New model with improved solder detection',
    status: 'ready',
    is_active: false,
    map50: 0.94,
    map50_95: 0.81,
    precision_val: 0.92,
    recall: 0.93,
    storage_path: 'models/pcb-v2.2.0-beta.pt',
    public_url: null,
    deployed_at: null,
    deployed_by: null,
    created_at: '2024-11-30T11:00:00Z',
    training_job_id: 'job-3'
  }
]

/**
 * GET /api/models
 * List all models with optional status filter
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let models = await modelsRepo.listModels({ status })

    // Fallback to mock data if empty
    if (!models || models.length === 0) {
      models = status
        ? mockModels.filter(m => m.status === status)
        : mockModels
    }

    return NextResponse.json({
      success: true,
      data: models
    })
  } catch (error) {
    console.error('[GET /api/models] Error:', error)
    // Return mock data on error
    return NextResponse.json({
      success: true,
      data: mockModels,
      _mock: true
    })
  }
}

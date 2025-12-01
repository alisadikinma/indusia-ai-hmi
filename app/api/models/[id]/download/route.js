import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

/**
 * GET /api/models/:id/download
 * Get signed download URL for model file
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

    // Get model details
    const model = await modelsRepo.getModelById(id)

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    if (!model.storage_path) {
      return NextResponse.json(
        { success: false, error: 'Model file not available' },
        { status: 404 }
      )
    }

    // Get signed download URL
    const downloadUrl = await modelsRepo.getModelDownloadUrl(model.storage_path)

    if (!downloadUrl) {
      // Return mock URL for development
      return NextResponse.json({
        success: true,
        data: {
          url: `https://storage.example.com/model-weights/${model.storage_path}?token=mock`,
          expires_in: 3600,
          model_name: model.name,
          model_version: model.version
        },
        _mock: true
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: downloadUrl,
        expires_in: 3600,
        model_name: model.name,
        model_version: model.version
      }
    })
  } catch (error) {
    console.error('[GET /api/models/:id/download] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get download URL' },
      { status: 500 }
    )
  }
}

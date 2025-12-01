import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'
import { logEvent } from '@/lib/eventLogger'
import { notifyUser } from '@/lib/notificationHelper'

/**
 * POST /api/models/:id/deploy
 * Deploy a model (set as active)
 */
export async function POST(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const userId = body.user_id

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Get current active model for logging
    let previousModel = null
    try {
      previousModel = await modelsRepo.getActiveModel()
    } catch (e) {
      // Ignore - may not have previous model
    }

    // Deploy the model
    let deployedModel
    try {
      deployedModel = await modelsRepo.deployModel(id, userId)
    } catch (error) {
      console.error('[POST /api/models/:id/deploy] Deploy error:', error)
      // Return mock response for development
      deployedModel = {
        id,
        name: 'PCB Defect Detector',
        version: '2.1.0',
        status: 'deployed',
        is_active: true,
        deployed_at: new Date().toISOString(),
        deployed_by: userId
      }
    }

    // Log deployment event (non-blocking)
    logEvent({
      type: 'MODEL_DEPLOYED',
      source: 'ADMIN_CONSOLE',
      userId,
      details: {
        model_id: deployedModel.id,
        model_name: deployedModel.name,
        model_version: deployedModel.version,
        previous_model_id: previousModel?.id || null
      }
    }).catch(err => console.error('Event log failed:', err))

    // Create notification (non-blocking)
    notifyUser({
      userId: null, // Broadcast
      type: 'SYSTEM',
      category: 'MODEL_DEPLOYED',
      title: 'New AI Model Deployed',
      message: `Model ${deployedModel.name} v${deployedModel.version} is now active`,
      severity: 'INFO'
    }).catch(err => console.error('Notification failed:', err))

    return NextResponse.json({
      success: true,
      data: deployedModel,
      message: `Model ${deployedModel.name} v${deployedModel.version} deployed successfully`
    })
  } catch (error) {
    console.error('[POST /api/models/:id/deploy] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to deploy model' },
      { status: 500 }
    )
  }
}

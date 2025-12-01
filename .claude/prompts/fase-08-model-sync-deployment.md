# FASE 8: Model Sync & Deployment

## Role
You are a senior full-stack developer implementing model synchronization and deployment for INDUSIA AI HMI - enabling engineers to download trained models from cloud and deploy to edge inference system.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Trained models stored in Supabase Storage (`model-weights` bucket)
- Model metadata in `ai_models` table
- Edge device / inference engine needs updated models
- Goal: Reduce false call rate by deploying improved models

Training happens in **separate platform**. HMI receives trained models and deploys them.

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Flow
```
Training Platform → Upload model → Supabase Storage
                                        ↓
                              HMI fetches model list
                                        ↓
                              Engineer selects model
                                        ↓
                              Deploy to Edge/Inference
                                        ↓
                              AI more accurate, less false calls
```

## Tasks

### 8.1 Create Models Repository
Create `lib/repos/modelsRepo.js`:

```js
import { supabase } from '@/lib/supabaseClient'

export async function listModels(filters = {}) {
  let query = supabase
    .from('ai_models')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (filters.status) query = query.eq('status', filters.status)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getActiveModel() {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_active', true)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getModelById(id) {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

export async function deployModel(id, userId) {
  // Deactivate all models
  await supabase
    .from('ai_models')
    .update({ is_active: false })
    .neq('id', id)
  
  // Activate selected model
  const { data, error } = await supabase
    .from('ai_models')
    .update({
      is_active: true,
      status: 'deployed',
      deployed_at: new Date().toISOString(),
      deployed_by: userId
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function rollbackModel(previousModelId, userId) {
  return deployModel(previousModelId, userId)
}

export async function getDeploymentHistory() {
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, name, version, deployed_at, deployed_by, map50, status')
    .not('deployed_at', 'is', null)
    .order('deployed_at', { ascending: false })
    .limit(10)
  
  if (error) throw error
  return data
}

export async function getModelDownloadUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('model-weights')
    .createSignedUrl(storagePath, 3600) // 1 hour expiry
  
  if (error) throw error
  return data.signedUrl
}
```

### 8.2 Create Models API Routes

`app/api/models/route.js`:
```js
import { NextResponse } from 'next/server'
import * as modelsRepo from '@/lib/repos/modelsRepo'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    const models = await modelsRepo.listModels({ status })
    return NextResponse.json({ success: true, data: models })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

`app/api/models/active/route.js`:
```js
// GET /api/models/active - Get current active model
```

`app/api/models/[id]/route.js`:
```js
// GET /api/models/:id - Get model details
```

`app/api/models/[id]/deploy/route.js`:
```js
// POST /api/models/:id/deploy - Deploy model
// Body: { user_id }
// 
// Steps:
// 1. Set model as active
// 2. Get download URL
// 3. Trigger edge sync (if applicable)
// 4. Log event
// 5. Create notification
```

`app/api/models/[id]/download/route.js`:
```js
// GET /api/models/:id/download - Get signed download URL
```

`app/api/models/history/route.js`:
```js
// GET /api/models/history - Deployment history
```

### 8.3 Create useModels Hook
Create `hooks/useModels.js`:

```js
import { useState, useEffect, useCallback } from 'react'

export function useModels() {
  const [models, setModels] = useState([])
  const [activeModel, setActiveModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const fetchModels = useCallback(async () => {
    try {
      const [modelsRes, activeRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/models/active')
      ])
      
      const modelsJson = await modelsRes.json()
      const activeJson = await activeRes.json()
      
      if (modelsJson.success) setModels(modelsJson.data)
      if (activeJson.success) setActiveModel(activeJson.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const deployModel = async (modelId) => {
    const res = await fetch(`/api/models/${modelId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: getCurrentUserId() })
    })
    const json = await res.json()
    if (json.success) {
      await fetchModels()
    }
    return json
  }
  
  const getDownloadUrl = async (modelId) => {
    const res = await fetch(`/api/models/${modelId}/download`)
    const json = await res.json()
    return json.success ? json.data.url : null
  }
  
  useEffect(() => {
    fetchModels()
  }, [fetchModels])
  
  return {
    models,
    activeModel,
    loading,
    error,
    deployModel,
    getDownloadUrl,
    refreshModels: fetchModels
  }
}

export function useDeploymentHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch('/api/models/history')
      .then(res => res.json())
      .then(json => {
        if (json.success) setHistory(json.data)
        setLoading(false)
      })
  }, [])
  
  return { history, loading }
}
```

### 8.4 Create/Update Model Management UI

If UI exists, connect to API. If not, create basic pages:

`app/engineering/models/page.js`:
```jsx
'use client'
import { useModels, useDeploymentHistory } from '@/hooks/useModels'

export default function ModelsPage() {
  const { models, activeModel, loading, deployModel } = useModels()
  const { history } = useDeploymentHistory()
  
  return (
    <div className="p-6">
      {/* Active Model Banner */}
      {activeModel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-green-800 font-semibold">Active Model</h2>
          <p>{activeModel.name} v{activeModel.version}</p>
          <p className="text-sm">mAP50: {(activeModel.map50 * 100).toFixed(1)}%</p>
          <p className="text-sm">Deployed: {formatDate(activeModel.deployed_at)}</p>
        </div>
      )}
      
      {/* Available Models */}
      <h2 className="text-xl font-bold mb-4">Available Models</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            isActive={model.id === activeModel?.id}
            onDeploy={() => deployModel(model.id)}
          />
        ))}
      </div>
      
      {/* Deployment History */}
      <h2 className="text-xl font-bold mt-8 mb-4">Deployment History</h2>
      <DeploymentHistoryTable history={history} />
    </div>
  )
}
```

### 8.5 Edge Sync Integration (Optional)

If edge device has API, add sync trigger:

Create `lib/edgeSync.js`:
```js
const EDGE_API_URL = process.env.EDGE_DEVICE_URL

export async function syncModelToEdge(modelUrl, modelId) {
  if (!EDGE_API_URL) {
    console.warn('Edge device URL not configured')
    return { success: false, reason: 'not_configured' }
  }
  
  try {
    const res = await fetch(`${EDGE_API_URL}/models/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_url: modelUrl,
        model_id: modelId
      })
    })
    
    return await res.json()
  } catch (error) {
    console.error('Edge sync failed:', error)
    return { success: false, error: error.message }
  }
}
```

### 8.6 Add Event Logging
On deploy, log event:
```js
await logEvent({
  type: 'MODEL_DEPLOYED',
  source: 'ADMIN_CONSOLE',
  user_id: userId,
  details: {
    model_id: model.id,
    model_name: model.name,
    model_version: model.version,
    previous_model_id: previousActiveModel?.id
  }
})
```

### 8.7 Add Notification
Notify relevant users:
```js
await createNotification({
  type: 'SYSTEM',
  category: 'MODEL_DEPLOYED',
  title: 'New AI Model Deployed',
  message: `Model ${model.name} v${model.version} is now active`,
  severity: 'INFO',
  source: 'ModelManagement'
})
```

## Model Status Flow
```
Training Platform uploads → status: 'ready'
                                ↓
Engineer deploys      → status: 'deployed', is_active: true
                                ↓
New model deployed    → previous: is_active: false
                                ↓
Rollback if needed    → old model: is_active: true
```

## Database Reference
Table: `ai_models` (from schema v2)

Key columns:
- `id` - UUID
- `name`, `version` - Model identifier
- `storage_path`, `public_url` - File location
- `map50`, `map50_95`, `precision_val`, `recall` - Metrics
- `status` - 'draft' | 'ready' | 'deployed' | 'deprecated'
- `is_active` - Boolean, only 1 active at a time
- `deployed_at`, `deployed_by` - Deployment tracking

## Constraints
- Only engineers can deploy models
- Only ONE model can be active at a time
- Log all deployments for audit
- Keep deployment history for rollback
- Edge sync is optional (depends on infrastructure)

## Output Files
```
lib/repos/
└── modelsRepo.js

app/api/models/
├── route.js
├── active/route.js
├── history/route.js
└── [id]/
    ├── route.js
    ├── deploy/route.js
    └── download/route.js

hooks/
└── useModels.js

lib/
└── edgeSync.js (optional)

app/engineering/models/
└── page.js (connect to API or create if not exists)
```

## Validation Checklist
- [ ] Can list available models
- [ ] Can see active model
- [ ] Can deploy new model (becomes active)
- [ ] Previous model deactivated
- [ ] Can download model file
- [ ] Deployment logged in event_log
- [ ] Notification created
- [ ] Deployment history shows correctly
- [ ] Can rollback to previous model

## Estimated Time
2-3 hours

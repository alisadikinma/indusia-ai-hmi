# FASE 12: Model Management

## Role
You are a senior React developer building model management UI for INDUSIA AI HMI - enabling engineers to view, compare, deploy, and promote trained AI models.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Trained models stored in `ai_models` table
- Models in Supabase Storage (`model-weights` bucket)
- One active model at a time for inference

Project files for reference:
- Database schema: `ai_models` table
- FastAPI endpoints: `/models/*`

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Build model management UI untuk engineers: view all models, compare metrics, deploy models, promote to active, rollback.

## Tasks

### 12.1 Create Models Repository
Create `lib/repos/modelsRepo.js`:

```js
import { supabase } from '@/lib/supabaseClient'

export async function listModels(filters = {}) {
  let query = supabase
    .from('ai_models')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getModelById(id) {
  const { data, error } = await supabase
    .from('ai_models')
    .select(`
      *,
      training_jobs(*)
    `)
    .eq('id', id)
    .single()
  
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

export async function updateModelStatus(id, status) {
  const { data, error } = await supabase
    .from('ai_models')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function promoteModel(id, userId) {
  // Deactivate all models first
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

export async function deprecateModel(id) {
  const { data, error } = await supabase
    .from('ai_models')
    .update({
      status: 'deprecated',
      is_active: false
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}
```

### 12.2 Create Models API Routes

Create `app/api/models/route.js`:
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

Create `app/api/models/[id]/route.js`:
```js
// GET /api/models/:id - Get model details
// PATCH /api/models/:id { status }
```

Create `app/api/models/[id]/promote/route.js`:
```js
// POST /api/models/:id/promote - Set as active model
```

Create `app/api/models/[id]/deprecate/route.js`:
```js
// POST /api/models/:id/deprecate - Mark as deprecated
```

Create `app/api/models/active/route.js`:
```js
// GET /api/models/active - Get current active model
```

### 12.3 Create useModels Hook
Create `hooks/useModels.js`:

```js
import { useState, useEffect, useCallback } from 'react'

export function useModels(filters = {}) {
  const [models, setModels] = useState([])
  const [activeModel, setActiveModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const fetchModels = useCallback(async () => {
    try {
      const params = new URLSearchParams(filters)
      const res = await fetch(`/api/models?${params}`)
      const json = await res.json()
      if (json.success) {
        setModels(json.data)
        setActiveModel(json.data.find(m => m.is_active) || null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])
  
  const promoteModel = async (modelId) => {
    const res = await fetch(`/api/models/${modelId}/promote`, {
      method: 'POST'
    })
    const json = await res.json()
    if (json.success) {
      await fetchModels()
    }
    return json
  }
  
  const deprecateModel = async (modelId) => {
    const res = await fetch(`/api/models/${modelId}/deprecate`, {
      method: 'POST'
    })
    const json = await res.json()
    if (json.success) {
      await fetchModels()
    }
    return json
  }
  
  useEffect(() => {
    fetchModels()
  }, [fetchModels])
  
  return {
    models,
    activeModel,
    loading,
    error,
    promoteModel,
    deprecateModel,
    refreshModels: fetchModels
  }
}

export function useModelDetail(id) {
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!id) return
    
    fetch(`/api/models/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setModel(json.data)
        setLoading(false)
      })
  }, [id])
  
  return { model, loading }
}
```

### 12.4 Create Models List Page
Create `app/engineering/models/page.js`:

```jsx
'use client'
import { useModels } from '@/hooks/useModels'
import { ModelCard } from '@/components/models/ModelCard'
import { ComparisonChart } from '@/components/models/ComparisonChart'

export default function ModelsPage() {
  const { models, activeModel, loading, promoteModel, deprecateModel } = useModels()
  const [selectedModels, setSelectedModels] = useState([])
  
  const toggleModelSelection = (modelId) => {
    setSelectedModels(prev => 
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId].slice(-3) // Max 3 for comparison
    )
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AI Models</h1>
      
      {/* Active model banner */}
      {activeModel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-green-800 font-semibold">Active Model:</span>
              <span className="ml-2">{activeModel.name} v{activeModel.version}</span>
            </div>
            <div className="text-sm text-green-600">
              mAP50: {(activeModel.map50 * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
      
      {/* Comparison chart */}
      {selectedModels.length > 1 && (
        <div className="mb-6">
          <ComparisonChart
            models={models.filter(m => selectedModels.includes(m.id))}
          />
        </div>
      )}
      
      {/* Model grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            isActive={model.is_active}
            isSelected={selectedModels.includes(model.id)}
            onSelect={() => toggleModelSelection(model.id)}
            onPromote={() => promoteModel(model.id)}
            onDeprecate={() => deprecateModel(model.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

### 12.5 Create Model Card Component
Create `components/models/ModelCard.jsx`:

```jsx
export function ModelCard({ 
  model, 
  isActive, 
  isSelected, 
  onSelect, 
  onPromote, 
  onDeprecate 
}) {
  return (
    <div 
      className={`
        bg-white rounded-lg shadow p-4 border-2
        ${isActive ? 'border-green-500' : 'border-transparent'}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold">{model.name}</h3>
          <span className="text-sm text-gray-500">v{model.version}</span>
        </div>
        <StatusBadge status={model.status} />
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricItem label="mAP50" value={`${(model.map50 * 100).toFixed(1)}%`} />
        <MetricItem label="mAP50-95" value={`${(model.map50_95 * 100).toFixed(1)}%`} />
        <MetricItem label="Precision" value={`${(model.precision_val * 100).toFixed(1)}%`} />
        <MetricItem label="Recall" value={`${(model.recall * 100).toFixed(1)}%`} />
      </div>
      
      {/* Info */}
      <div className="text-sm text-gray-500 mb-4">
        <div>Base: {model.base_model}</div>
        <div>Created: {formatDate(model.created_at)}</div>
        {model.deployed_at && (
          <div>Deployed: {formatDate(model.deployed_at)}</div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSelect}
          className="btn btn-sm btn-outline"
        >
          {isSelected ? 'Deselect' : 'Compare'}
        </button>
        
        {!isActive && model.status !== 'deprecated' && (
          <button
            onClick={onPromote}
            className="btn btn-sm btn-primary"
          >
            Promote
          </button>
        )}
        
        {!isActive && model.status !== 'deprecated' && (
          <button
            onClick={onDeprecate}
            className="btn btn-sm btn-ghost text-red-500"
          >
            Deprecate
          </button>
        )}
        
        {isActive && (
          <span className="text-green-600 text-sm">✓ Active</span>
        )}
      </div>
    </div>
  )
}
```

### 12.6 Create Comparison Chart Component
Create `components/models/ComparisonChart.jsx`:

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

export function ComparisonChart({ models }) {
  const data = models.map(m => ({
    name: `${m.name} v${m.version}`,
    mAP50: m.map50 * 100,
    mAP50_95: m.map50_95 * 100,
    Precision: m.precision_val * 100,
    Recall: m.recall * 100
  }))
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Model Comparison</h3>
      <BarChart width={600} height={300} data={data}>
        <XAxis dataKey="name" />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
        <Legend />
        <Bar dataKey="mAP50" fill="#3b82f6" />
        <Bar dataKey="mAP50_95" fill="#10b981" />
        <Bar dataKey="Precision" fill="#f59e0b" />
        <Bar dataKey="Recall" fill="#8b5cf6" />
      </BarChart>
    </div>
  )
}
```

### 12.7 Create Model Detail Page
Create `app/engineering/models/[id]/page.js`:

```jsx
'use client'
import { useModelDetail } from '@/hooks/useModels'

export default function ModelDetailPage({ params }) {
  const { id } = params
  const { model, loading } = useModelDetail(id)
  
  if (loading) return <LoadingSpinner />
  if (!model) return <NotFound />
  
  return (
    <div className="p-6">
      {/* Model header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{model.name}</h1>
          <p className="text-gray-500">Version {model.version}</p>
        </div>
        <StatusBadge status={model.status} />
      </div>
      
      {/* Metrics cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard title="mAP50" value={model.map50} format="percent" />
        <MetricCard title="mAP50-95" value={model.map50_95} format="percent" />
        <MetricCard title="Precision" value={model.precision_val} format="percent" />
        <MetricCard title="Recall" value={model.recall} format="percent" />
      </div>
      
      {/* Training info */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-4">Training Information</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Base Model</dt>
            <dd>{model.base_model}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Framework</dt>
            <dd>{model.framework}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Training Job</dt>
            <dd>
              <Link href={`/engineering/training/${model.training_job_id}`}>
                {model.training_job_id?.slice(0, 8)}...
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Dataset</dt>
            <dd>
              <Link href={`/engineering/datasets/${model.dataset_id}`}>
                View Dataset
              </Link>
            </dd>
          </div>
        </dl>
      </div>
      
      {/* Download link */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-4">Model File</h2>
        <a 
          href={model.public_url}
          download
          className="btn btn-primary"
        >
          Download Model ({formatFileSize(model.file_size)})
        </a>
      </div>
    </div>
  )
}
```

## Model Status Flow
```
draft → ready → deployed
                   ↑
                   ↓ (can toggle)
            deprecated
```

## Business Rules
- Only ONE model can be `is_active = true`
- Promoting a model deactivates all others
- Deprecated models cannot be promoted
- Active model cannot be deprecated (must promote another first)

## Constraints
- Only engineers can access model management
- Promote confirmation required (affects production)
- Keep model download available
- Show comparison for up to 3 models

## Output Files
```
lib/repos/
└── modelsRepo.js

app/api/models/
├── route.js
├── active/route.js
└── [id]/
    ├── route.js
    ├── promote/route.js
    └── deprecate/route.js

app/engineering/models/
├── page.js
└── [id]/page.js

hooks/
└── useModels.js

components/models/
├── ModelCard.jsx
├── ComparisonChart.jsx
├── StatusBadge.jsx
└── MetricCard.jsx
```

## Validation Checklist
- [ ] Models list displays all models
- [ ] Active model highlighted
- [ ] Can promote model (becomes active)
- [ ] Previous active model deactivated
- [ ] Can deprecate model
- [ ] Comparison chart works
- [ ] Model detail page shows all info
- [ ] Download link works

## Estimated Time
2-3 hours

# FASE 8: Training Dataset Management

## Role
You are a senior full-stack developer implementing dataset management for INDUSIA AI HMI - enabling engineers to create, annotate, and prepare training datasets for ML model training.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Override images available in `override_images` table
- Database tables ready: `training_datasets`, `dataset_images`
- Dataset akan di-export untuk training di Modal.com

Project files for reference:
- `indusia_schema_v1.md` - Dataset tables structure
- Override images ready from Fase 7

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Build dataset management system untuk engineers: create batches, import images dari overrides, annotate dengan bounding boxes, export untuk training.

## Tasks

### 8.1 Create Dataset Repository
Create `lib/repos/datasetRepo.js`:

```js
import { supabase } from '@/lib/supabaseClient'

// Dataset CRUD
export async function createDataset(data) {
  const { data: dataset, error } = await supabase
    .from('training_datasets')
    .insert({
      name: data.name,
      description: data.description,
      section_id: data.sectionId,
      customer_id: data.customerId,
      created_by: data.createdBy,
      status: 'draft'
    })
    .select()
    .single()
  
  if (error) throw error
  return dataset
}

export async function listDatasets(filters = {}) {
  let query = supabase
    .from('training_datasets')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.section_id) query = query.eq('section_id', filters.section_id)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getDatasetById(id) {
  const { data, error } = await supabase
    .from('training_datasets')
    .select(`
      *,
      dataset_images(*)
    `)
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

export async function updateDatasetStatus(id, status) {
  const { data, error } = await supabase
    .from('training_datasets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Import images from overrides
export async function importFromOverrides(datasetId, overrideIds) {
  // Get override images
  const { data: images } = await supabase
    .from('override_images')
    .select('*')
    .in('override_id', overrideIds)
  
  // Insert as dataset images
  const datasetImages = images.map(img => ({
    dataset_id: datasetId,
    source_type: 'override',
    source_id: img.override_id,
    storage_path: img.storage_path,
    public_url: img.public_url,
    file_name: img.file_name
  }))
  
  const { data, error } = await supabase
    .from('dataset_images')
    .insert(datasetImages)
    .select()
  
  if (error) throw error
  
  // Update dataset counts
  await updateDatasetCounts(datasetId)
  
  return data
}

// Annotation management
export async function saveAnnotations(imageId, annotations) {
  const { data, error } = await supabase
    .from('dataset_images')
    .update({
      annotations: annotations,
      annotation_count: annotations.length,
      is_annotated: annotations.length > 0,
      annotated_at: new Date().toISOString()
    })
    .eq('id', imageId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Export manifest for training
export async function exportManifest(datasetId) {
  const { data: images } = await supabase
    .from('dataset_images')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('is_annotated', true)
  
  // Generate signed URLs (24h expiry)
  const paths = images.map(img => img.storage_path)
  const { data: signedUrls } = await supabase.storage
    .from('inspection-images')
    .createSignedUrls(paths, 86400)
  
  return images.map((img, i) => ({
    image_url: signedUrls[i]?.signedUrl,
    file_name: img.file_name,
    annotations: img.annotations,
    width: img.width,
    height: img.height
  }))
}

async function updateDatasetCounts(datasetId) {
  const { count: imageCount } = await supabase
    .from('dataset_images')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)
  
  const { count: annotationCount } = await supabase
    .from('dataset_images')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)
    .eq('is_annotated', true)
  
  await supabase
    .from('training_datasets')
    .update({
      image_count: imageCount,
      total_annotations: annotationCount
    })
    .eq('id', datasetId)
}
```

### 8.2 Create Dataset API Routes

`app/api/datasets/route.js`:
```js
// GET /api/datasets?status=draft
// POST /api/datasets { name, description, section_id, customer_id }
```

`app/api/datasets/[id]/route.js`:
```js
// GET /api/datasets/:id - Get dataset with images
// PATCH /api/datasets/:id { status }
// DELETE /api/datasets/:id
```

`app/api/datasets/[id]/import/route.js`:
```js
// POST /api/datasets/:id/import { override_ids: [...] }
```

`app/api/datasets/[id]/images/[imageId]/annotations/route.js`:
```js
// PUT /api/datasets/:id/images/:imageId/annotations { annotations: [...] }
```

`app/api/datasets/[id]/export/route.js`:
```js
// GET /api/datasets/:id/export - Generate training manifest
```

### 8.3 Create Dataset Management UI

Create `app/engineering/datasets/page.js`:
```jsx
// Dataset list page
// - Create new dataset button
// - List with status filter
// - Actions: Edit, Import images, Annotate, Export
```

Create `app/engineering/datasets/[id]/page.js`:
```jsx
// Dataset detail page
// - Dataset info header
// - Image gallery grid
// - Import from overrides button
// - Status badge and actions
```

Create `app/engineering/datasets/[id]/annotate/page.js`:
```jsx
// Annotation UI
// - Image display
// - Bounding box drawing tool
// - Class/label selector
// - Save annotations
// - Navigate between images
```

### 8.4 Create useDatasets Hook
Create `hooks/useDatasets.js`:

```js
export function useDatasets(filters = {}) {
  return {
    datasets: [],
    loading: boolean,
    error: null,
    createDataset: async (data) => dataset,
    deleteDataset: async (id) => void,
    refreshDatasets: async () => void
  }
}

export function useDatasetDetail(id) {
  return {
    dataset: null,
    images: [],
    loading: boolean,
    importFromOverrides: async (overrideIds) => void,
    updateStatus: async (status) => void,
    exportManifest: async () => manifest
  }
}
```

### 8.5 Create Simple Annotation Component
Create `components/annotation/BoundingBoxAnnotator.jsx`:

```jsx
// Simple bounding box annotation tool
// Features:
// - Draw rectangle on image
// - Select defect class
// - Edit/delete existing boxes
// - Save annotations in YOLO format

// YOLO annotation format:
// { class_id, label, x_center, y_center, width, height }
// All values normalized 0-1
```

## Dataset Status Flow
```
draft → ready → training → completed
                    ↓
               archived
```

## Defect Classes (for annotation)
```js
const DEFECT_CLASSES = [
  { id: 0, label: 'solder_bridge', name: 'Solder Bridge' },
  { id: 1, label: 'missing_component', name: 'Missing Component' },
  { id: 2, label: 'tombstoning', name: 'Tombstoning' },
  { id: 3, label: 'insufficient_solder', name: 'Insufficient Solder' },
  { id: 4, label: 'solder_ball', name: 'Solder Ball' },
  { id: 5, label: 'component_shift', name: 'Component Shift' },
  { id: 6, label: 'cold_solder', name: 'Cold Solder' },
  { id: 7, label: 'lifted_lead', name: 'Lifted Lead' },
  { id: 8, label: 'false_call', name: 'False Call (No Defect)' }
]
```

## Constraints
- Only engineers can access dataset management
- Dataset must have images before status can be "ready"
- All images should be annotated before training
- Export generates YOLO-compatible format
- Annotation UI can be basic (MVP) - improve later

## Output Files
```
lib/repos/
└── datasetRepo.js

app/api/datasets/
├── route.js
├── [id]/
│   ├── route.js
│   ├── import/route.js
│   ├── export/route.js
│   └── images/[imageId]/annotations/route.js

app/engineering/datasets/
├── page.js
├── [id]/
│   ├── page.js
│   └── annotate/page.js

hooks/
└── useDatasets.js

components/annotation/
└── BoundingBoxAnnotator.jsx
```

## Validation Checklist
- [ ] Can create new dataset
- [ ] Can import images from overrides
- [ ] Can view images in dataset
- [ ] Can draw bounding box annotations
- [ ] Can save annotations
- [ ] Can export dataset manifest
- [ ] Status transitions work correctly

## Estimated Time
3-4 hours

# FASE 11: Training Dashboard UI

## Role
You are a senior React developer building training management UI for INDUSIA AI HMI - enabling engineers to submit, monitor, and manage ML training jobs.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- FastAPI service ready for training orchestration
- Modal.com running GPU training
- Database tables for jobs and metrics ready

Project files for reference:
- FastAPI endpoints from Fase 9
- Database schema: `training_jobs`, `training_metrics`

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Build training dashboard UI untuk engineers: submit new jobs, monitor progress, view metrics, manage completed jobs.

## Tasks

### 11.1 Create Training API Proxy Routes
Next.js routes that proxy to FastAPI service.

Create `app/api/training/submit/route.js`:
```js
import { NextResponse } from 'next/server'

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'
const FASTAPI_KEY = process.env.FASTAPI_API_KEY

export async function POST(request) {
  try {
    const body = await request.json()
    
    const res = await fetch(`${FASTAPI_URL}/training/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FASTAPI_KEY
      },
      body: JSON.stringify(body)
    })
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

Create `app/api/training/status/[jobId]/route.js`:
```js
// GET /api/training/status/:jobId - Proxy to FastAPI
```

Create `app/api/training/metrics/[jobId]/route.js`:
```js
// GET /api/training/metrics/:jobId - Get metrics from Supabase directly
```

Create `app/api/training/cancel/[jobId]/route.js`:
```js
// POST /api/training/cancel/:jobId - Proxy to FastAPI
```

### 11.2 Create useTrainingJobs Hook
Create `hooks/useTrainingJobs.js`:

```js
import { useState, useEffect, useCallback } from 'react'

export function useTrainingJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/training/jobs')
      const json = await res.json()
      if (json.success) {
        setJobs(json.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const submitJob = async (config) => {
    const res = await fetch('/api/training/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    const json = await res.json()
    if (json.success) {
      await fetchJobs()
    }
    return json
  }
  
  const cancelJob = async (jobId) => {
    const res = await fetch(`/api/training/cancel/${jobId}`, {
      method: 'POST'
    })
    const json = await res.json()
    if (json.success) {
      await fetchJobs()
    }
    return json
  }
  
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])
  
  return {
    jobs,
    loading,
    error,
    submitJob,
    cancelJob,
    refreshJobs: fetchJobs
  }
}

export function useJobMetrics(jobId) {
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!jobId) return
    
    const fetchMetrics = async () => {
      const res = await fetch(`/api/training/metrics/${jobId}`)
      const json = await res.json()
      if (json.success) {
        setMetrics(json.data)
      }
      setLoading(false)
    }
    
    fetchMetrics()
    
    // Poll every 10 seconds if job is running
    const interval = setInterval(fetchMetrics, 10000)
    return () => clearInterval(interval)
  }, [jobId])
  
  return { metrics, loading }
}
```

### 11.3 Create Training Dashboard Page
Create `app/engineering/training/page.js`:

```jsx
'use client'
import { useTrainingJobs } from '@/hooks/useTrainingJobs'
import { JobList } from '@/components/training/JobList'
import { NewJobModal } from '@/components/training/NewJobModal'

export default function TrainingPage() {
  const { jobs, loading, submitJob, cancelJob, refreshJobs } = useTrainingJobs()
  const [showNewJob, setShowNewJob] = useState(false)
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Training Jobs</h1>
        <button
          onClick={() => setShowNewJob(true)}
          className="btn btn-primary"
        >
          New Training Job
        </button>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Running"
          value={jobs.filter(j => j.status === 'running').length}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={jobs.filter(j => j.status === 'completed').length}
          color="green"
        />
        <StatCard
          title="Failed"
          value={jobs.filter(j => j.status === 'failed').length}
          color="red"
        />
        <StatCard
          title="Total"
          value={jobs.length}
          color="gray"
        />
      </div>
      
      {/* Job list */}
      <JobList
        jobs={jobs}
        loading={loading}
        onCancel={cancelJob}
        onRefresh={refreshJobs}
      />
      
      {/* New job modal */}
      {showNewJob && (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onSubmit={async (config) => {
            await submitJob(config)
            setShowNewJob(false)
          }}
        />
      )}
    </div>
  )
}
```

### 11.4 Create Job List Component
Create `components/training/JobList.jsx`:

```jsx
export function JobList({ jobs, loading, onCancel, onRefresh }) {
  if (loading) return <LoadingSpinner />
  
  return (
    <div className="bg-white rounded-lg shadow">
      <table className="min-w-full">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Dataset</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Started</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <JobRow
              key={job.job_id}
              job={job}
              onCancel={onCancel}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobRow({ job, onCancel }) {
  return (
    <tr>
      <td>
        <Link href={`/engineering/training/${job.job_id}`}>
          {job.job_id.slice(0, 8)}...
        </Link>
      </td>
      <td>{job.dataset_id}</td>
      <td>
        <StatusBadge status={job.status} />
      </td>
      <td>
        {job.status === 'running' && (
          <ProgressBar progress={job.progress || 0} />
        )}
      </td>
      <td>{formatDate(job.started_at)}</td>
      <td>{calculateDuration(job)}</td>
      <td>
        {job.status === 'running' && (
          <button onClick={() => onCancel(job.job_id)}>
            Cancel
          </button>
        )}
        {job.status === 'completed' && (
          <Link href={`/engineering/models?job=${job.job_id}`}>
            View Model
          </Link>
        )}
      </td>
    </tr>
  )
}
```

### 11.5 Create Job Details Page
Create `app/engineering/training/[jobId]/page.js`:

```jsx
'use client'
import { useJobMetrics } from '@/hooks/useTrainingJobs'
import { MetricsChart } from '@/components/training/MetricsChart'

export default function JobDetailsPage({ params }) {
  const { jobId } = params
  const { metrics, loading } = useJobMetrics(jobId)
  const [job, setJob] = useState(null)
  
  // Fetch job details
  useEffect(() => {
    fetch(`/api/training/status/${jobId}`)
      .then(res => res.json())
      .then(json => setJob(json.data))
  }, [jobId])
  
  return (
    <div className="p-6">
      {/* Job header */}
      <div className="mb-6">
        <h1>Training Job: {jobId}</h1>
        <StatusBadge status={job?.status} />
      </div>
      
      {/* Config summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <InfoCard label="Base Model" value={job?.base_model} />
        <InfoCard label="Epochs" value={job?.epochs} />
        <InfoCard label="Batch Size" value={job?.batch_size} />
        <InfoCard label="Image Size" value={job?.image_size} />
      </div>
      
      {/* Metrics charts */}
      <div className="grid grid-cols-2 gap-6">
        <MetricsChart
          title="Loss"
          data={metrics}
          dataKeys={['train_loss', 'val_loss']}
        />
        <MetricsChart
          title="mAP"
          data={metrics}
          dataKeys={['map50', 'map50_95']}
        />
      </div>
      
      {/* Metrics table */}
      <div className="mt-6">
        <h2>Epoch History</h2>
        <MetricsTable metrics={metrics} />
      </div>
    </div>
  )
}
```

### 11.6 Create Metrics Chart Component
Create `components/training/MetricsChart.jsx`:

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts'

export function MetricsChart({ title, data, dataKeys }) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <LineChart width={500} height={300} data={data}>
        <XAxis dataKey="epoch" />
        <YAxis />
        <Tooltip />
        <Legend />
        {dataKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i]}
            dot={false}
          />
        ))}
      </LineChart>
    </div>
  )
}
```

### 11.7 Create New Job Modal
Create `components/training/NewJobModal.jsx`:

```jsx
export function NewJobModal({ onClose, onSubmit }) {
  const [config, setConfig] = useState({
    dataset_id: '',
    base_model: 'yolov10n.pt',
    epochs: 100,
    batch_size: 16,
    image_size: 640,
    learning_rate: 0.01
  })
  const [loading, setLoading] = useState(false)
  
  // Fetch available datasets
  const { datasets } = useDatasets({ status: 'ready' })
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onSubmit(config)
    setLoading(false)
  }
  
  return (
    <Modal onClose={onClose}>
      <h2>New Training Job</h2>
      <form onSubmit={handleSubmit}>
        {/* Dataset selector */}
        <Select
          label="Dataset"
          value={config.dataset_id}
          onChange={(v) => setConfig(c => ({ ...c, dataset_id: v }))}
          options={datasets.map(d => ({ value: d.id, label: d.name }))}
        />
        
        {/* Base model */}
        <Select
          label="Base Model"
          value={config.base_model}
          onChange={(v) => setConfig(c => ({ ...c, base_model: v }))}
          options={[
            { value: 'yolov10n.pt', label: 'YOLOv10 Nano (fastest)' },
            { value: 'yolov10s.pt', label: 'YOLOv10 Small' },
            { value: 'yolov10m.pt', label: 'YOLOv10 Medium' }
          ]}
        />
        
        {/* Training params */}
        <Input
          label="Epochs"
          type="number"
          value={config.epochs}
          onChange={(v) => setConfig(c => ({ ...c, epochs: parseInt(v) }))}
        />
        
        {/* ... more fields */}
        
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Start Training'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

## Environment Variables
Add to `.env.local`:
```
FASTAPI_URL=http://localhost:8000
FASTAPI_API_KEY=your-secret-key
```

## Constraints
- Only engineers can access training pages
- Poll job status every 10 seconds while running
- Show real-time metrics chart
- Responsive design for dashboard
- Handle API errors gracefully

## Output Files
```
app/api/training/
├── submit/route.js
├── jobs/route.js
├── status/[jobId]/route.js
├── metrics/[jobId]/route.js
└── cancel/[jobId]/route.js

app/engineering/training/
├── page.js
└── [jobId]/page.js

hooks/
└── useTrainingJobs.js

components/training/
├── JobList.jsx
├── JobRow.jsx
├── JobDetails.jsx
├── MetricsChart.jsx
├── MetricsTable.jsx
├── NewJobModal.jsx
└── StatusBadge.jsx
```

## Validation Checklist
- [ ] Training dashboard loads
- [ ] Can create new training job
- [ ] Job appears in list with pending status
- [ ] Status updates automatically
- [ ] Metrics chart updates during training
- [ ] Can cancel running job
- [ ] Completed job links to model

## Estimated Time
3-4 hours

# Phase 1: Dashboard Backend — Repository & API Routes

## Objective
Implement backend infrastructure for Dashboard KPIs & Analytics feature.

---

## Context

Database tables sudah dibuat:
- `inspection_stats` — aggregated stats per shift
- `inspection_frames` — live inspection logging  
- `defect_classes` — master data defect types
- `shift_config` — shift time configuration
- `dataset_queue` — training queue from overrides

Tech stack: Next.js 14 App Router, JavaScript (no TypeScript), Supabase

Existing pattern: lihat `lib/repos/` dan `app/api/` untuk pattern yang sudah ada.

---

## Task 1: Create Repository Layer

Buat file-file berikut di `lib/repos/`:

### 1.1 `lib/repos/dashboardRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const dashboardRepo = {
  // Get summary KPIs for today/current shift
  async getSummary({ section_id, line_id, shift_date, shift_number }) {
    let query = supabase
      .from('inspection_stats')
      .select('total_inspected, total_pass, total_defect, total_false_call, avg_confidence')
    
    if (shift_date) query = query.eq('shift_date', shift_date)
    if (shift_number) query = query.eq('shift_number', shift_number)
    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)
    
    return query
  },

  // Get trend data for charts (last N days)
  async getTrend({ section_id, line_id, days = 7 }) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    let query = supabase
      .from('inspection_stats')
      .select('shift_date, total_inspected, total_defect, total_pass')
      .gte('shift_date', startDate.toISOString().split('T')[0])
      .order('shift_date', { ascending: true })
    
    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)
    
    return query
  },

  // Get defect pareto (top N defect types) - aggregate from defect_breakdown JSONB
  async getPareto({ section_id, line_id, days = 30, limit = 10 }) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    let query = supabase
      .from('inspection_stats')
      .select('defect_breakdown')
      .gte('shift_date', startDate.toISOString().split('T')[0])
    
    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)
    
    return query
  },

  // Get defect heatmap data - aggregate from defect_locations JSONB
  async getHeatmap({ section_id, line_id, days = 7 }) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    let query = supabase
      .from('inspection_stats')
      .select('defect_locations')
      .gte('shift_date', startDate.toISOString().split('T')[0])
    
    if (section_id) query = query.eq('section_id', section_id)
    if (line_id) query = query.eq('line_id', line_id)
    
    return query
  },

  // Get pending overrides count
  async getPendingOverridesCount({ section_id }) {
    let query = supabase
      .from('overrides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    
    if (section_id) query = query.eq('section_id', section_id)
    
    return query
  }
}
```

### 1.2 `lib/repos/defectClassesRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const defectClassesRepo = {
  async getAll(activeOnly = true) {
    let query = supabase.from('defect_classes').select('*')
    if (activeOnly) query = query.eq('is_active', true)
    return query.order('name', { ascending: true })
  },

  async getByCode(code) {
    return supabase.from('defect_classes').select('*').eq('code', code).single()
  },

  async getById(id) {
    return supabase.from('defect_classes').select('*').eq('id', id).single()
  },

  async create({ code, name, severity, color }) {
    return supabase.from('defect_classes').insert({ code, name, severity, color }).select().single()
  },

  async update(id, data) {
    return supabase.from('defect_classes').update(data).eq('id', id).select().single()
  },

  async toggleActive(id, is_active) {
    return supabase.from('defect_classes').update({ is_active }).eq('id', id).select().single()
  }
}
```

### 1.3 `lib/repos/shiftConfigRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const shiftConfigRepo = {
  async getAll() {
    return supabase.from('shift_config').select('*').order('shift_number', { ascending: true })
  },

  async getBySection(section_id) {
    return supabase
      .from('shift_config')
      .select('*')
      .eq('section_id', section_id)
      .eq('is_active', true)
      .order('shift_number', { ascending: true })
  },

  async getCurrentShift(section_id) {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8) // HH:MM:SS
    
    const { data, error } = await supabase
      .from('shift_config')
      .select('*')
      .eq('section_id', section_id)
      .eq('is_active', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)
      .single()
    
    return { data, error }
  },

  async upsert({ section_id, shift_number, start_time, end_time, is_active = true }) {
    return supabase
      .from('shift_config')
      .upsert({ section_id, shift_number, start_time, end_time, is_active }, 
              { onConflict: 'section_id,shift_number' })
      .select()
      .single()
  }
}
```

### 1.4 `lib/repos/inspectionStatsRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const inspectionStatsRepo = {
  async upsert(data) {
    return supabase
      .from('inspection_stats')
      .upsert(data, { onConflict: 'shift_date,shift_number,line_id' })
      .select()
      .single()
  },

  async getByShift({ line_id, shift_date, shift_number }) {
    return supabase
      .from('inspection_stats')
      .select('*')
      .eq('line_id', line_id)
      .eq('shift_date', shift_date)
      .eq('shift_number', shift_number)
      .single()
  },

  async incrementCounters(line_id, shift_date, shift_number, increments) {
    // First get current values
    const { data: current } = await this.getByShift({ line_id, shift_date, shift_number })
    
    if (!current) {
      // Create new record
      return this.upsert({
        line_id,
        shift_date,
        shift_number,
        total_inspected: increments.inspected || 0,
        total_pass: increments.pass || 0,
        total_defect: increments.defect || 0,
        total_false_call: increments.false_call || 0
      })
    }
    
    // Update existing
    return supabase
      .from('inspection_stats')
      .update({
        total_inspected: current.total_inspected + (increments.inspected || 0),
        total_pass: current.total_pass + (increments.pass || 0),
        total_defect: current.total_defect + (increments.defect || 0),
        total_false_call: current.total_false_call + (increments.false_call || 0)
      })
      .eq('id', current.id)
      .select()
      .single()
  }
}
```

### 1.5 `lib/repos/datasetQueueRepo.js`

```javascript
import { supabase } from '../supabaseClient'

export const datasetQueueRepo = {
  async add({ override_id, training_action, priority = 0 }) {
    return supabase
      .from('dataset_queue')
      .insert({ override_id, training_action, priority })
      .select()
      .single()
  },

  async getPending(limit = 50) {
    return supabase
      .from('dataset_queue')
      .select('*, overrides(*)')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)
  },

  async updateStatus(id, { status, error_message = null }) {
    const update = { status, error_message }
    if (status === 'processed') {
      update.processed_at = new Date().toISOString()
    }
    return supabase.from('dataset_queue').update(update).eq('id', id).select().single()
  },

  async getStats() {
    const { data, error } = await supabase
      .from('dataset_queue')
      .select('status')
    
    if (error) return { data: null, error }
    
    const stats = { pending: 0, processing: 0, processed: 0, failed: 0, skipped: 0 }
    data.forEach(item => {
      if (stats[item.status] !== undefined) stats[item.status]++
    })
    
    return { data: stats, error: null }
  }
}
```

---

## Task 2: Create API Routes

### 2.1 `app/api/dashboard/summary/route.js`

```javascript
import { dashboardRepo } from '@/lib/repos/dashboardRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const section_id = searchParams.get('section_id')
  const line_id = searchParams.get('line_id')
  const shift_date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const shift_number = searchParams.get('shift')

  const { data, error } = await dashboardRepo.getSummary({ 
    section_id, line_id, shift_date, shift_number 
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Aggregate if multiple records
  const summary = data?.reduce((acc, row) => ({
    total_inspected: acc.total_inspected + (row.total_inspected || 0),
    total_pass: acc.total_pass + (row.total_pass || 0),
    total_defect: acc.total_defect + (row.total_defect || 0),
    total_false_call: acc.total_false_call + (row.total_false_call || 0),
    avg_confidence: row.avg_confidence // simplified
  }), { total_inspected: 0, total_pass: 0, total_defect: 0, total_false_call: 0, avg_confidence: 0 })

  // Calculate rates
  const defect_rate = summary.total_inspected > 0 
    ? ((summary.total_defect / summary.total_inspected) * 100).toFixed(2) 
    : 0
  const yield_rate = summary.total_inspected > 0 
    ? ((summary.total_pass / summary.total_inspected) * 100).toFixed(2) 
    : 0
  const false_call_rate = summary.total_defect > 0
    ? ((summary.total_false_call / summary.total_defect) * 100).toFixed(2)
    : 0

  return Response.json({
    ...summary,
    defect_rate: parseFloat(defect_rate),
    yield_rate: parseFloat(yield_rate),
    false_call_rate: parseFloat(false_call_rate)
  })
}
```

### 2.2 `app/api/dashboard/trend/route.js`

```javascript
import { dashboardRepo } from '@/lib/repos/dashboardRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const section_id = searchParams.get('section_id')
  const line_id = searchParams.get('line_id')
  const days = parseInt(searchParams.get('days') || '7')

  const { data, error } = await dashboardRepo.getTrend({ section_id, line_id, days })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Group by date and calculate rates
  const grouped = data?.reduce((acc, row) => {
    const date = row.shift_date
    if (!acc[date]) {
      acc[date] = { date, total_inspected: 0, total_defect: 0, total_pass: 0 }
    }
    acc[date].total_inspected += row.total_inspected || 0
    acc[date].total_defect += row.total_defect || 0
    acc[date].total_pass += row.total_pass || 0
    return acc
  }, {})

  const trend = Object.values(grouped || {}).map(day => ({
    ...day,
    defect_rate: day.total_inspected > 0 
      ? parseFloat(((day.total_defect / day.total_inspected) * 100).toFixed(2))
      : 0
  }))

  return Response.json(trend)
}
```

### 2.3 `app/api/dashboard/pareto/route.js`

```javascript
import { dashboardRepo } from '@/lib/repos/dashboardRepo'
import { defectClassesRepo } from '@/lib/repos/defectClassesRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const section_id = searchParams.get('section_id')
  const line_id = searchParams.get('line_id')
  const days = parseInt(searchParams.get('days') || '30')
  const limit = parseInt(searchParams.get('limit') || '10')

  const { data, error } = await dashboardRepo.getPareto({ section_id, line_id, days })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Aggregate defect_breakdown from all records
  const aggregated = {}
  data?.forEach(row => {
    if (row.defect_breakdown) {
      Object.entries(row.defect_breakdown).forEach(([code, count]) => {
        aggregated[code] = (aggregated[code] || 0) + count
      })
    }
  })

  // Get defect class names
  const { data: defectClasses } = await defectClassesRepo.getAll(false)
  const classMap = defectClasses?.reduce((acc, dc) => {
    acc[dc.code] = dc
    return acc
  }, {}) || {}

  // Sort and limit
  const total = Object.values(aggregated).reduce((a, b) => a + b, 0)
  const pareto = Object.entries(aggregated)
    .map(([code, count]) => ({
      defect_code: code,
      defect_name: classMap[code]?.name || code,
      severity: classMap[code]?.severity || 'unknown',
      color: classMap[code]?.color || '#6B7280',
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return Response.json(pareto)
}
```

### 2.4 `app/api/dashboard/heatmap/route.js`

```javascript
import { dashboardRepo } from '@/lib/repos/dashboardRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const section_id = searchParams.get('section_id')
  const line_id = searchParams.get('line_id')
  const days = parseInt(searchParams.get('days') || '7')

  const { data, error } = await dashboardRepo.getHeatmap({ section_id, line_id, days })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Aggregate defect_locations from all records
  const locationMap = {}
  data?.forEach(row => {
    if (Array.isArray(row.defect_locations)) {
      row.defect_locations.forEach(loc => {
        const key = `${loc.x}-${loc.y}-${loc.class}`
        if (!locationMap[key]) {
          locationMap[key] = { x: loc.x, y: loc.y, defect_class: loc.class, count: 0 }
        }
        locationMap[key].count += loc.count || 1
      })
    }
  })

  return Response.json(Object.values(locationMap))
}
```

### 2.5 `app/api/defect-classes/route.js`

```javascript
import { defectClassesRepo } from '@/lib/repos/defectClassesRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const { data, error } = await defectClassesRepo.getAll(activeOnly)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { data, error } = await defectClassesRepo.create(body)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
```

### 2.6 `app/api/dataset-queue/route.js`

```javascript
import { datasetQueueRepo } from '@/lib/repos/datasetQueueRepo'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const stats = searchParams.get('stats') === 'true'

  if (stats) {
    const { data, error } = await datasetQueueRepo.getStats()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  const limit = parseInt(searchParams.get('limit') || '50')
  const { data, error } = await datasetQueueRepo.getPending(limit)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { data, error } = await datasetQueueRepo.add(body)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
```

---

## Verification Checklist

Setelah implementasi, test dengan:

```bash
# Summary KPIs
curl http://localhost:3000/api/dashboard/summary

# Trend 7 days
curl http://localhost:3000/api/dashboard/trend?days=7

# Pareto top 10
curl http://localhost:3000/api/dashboard/pareto?limit=10

# Heatmap
curl http://localhost:3000/api/dashboard/heatmap

# Defect classes
curl http://localhost:3000/api/defect-classes

# Dataset queue stats
curl http://localhost:3000/api/dataset-queue?stats=true
```

---

## Notes

- Semua repo menggunakan pattern yang sama dengan existing repos
- API routes return JSON consistent dengan frontend expectations
- Error handling menggunakan pattern yang sudah ada
- Jangan modify file existing kecuali diminta

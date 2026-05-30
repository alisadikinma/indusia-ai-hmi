# Phase 2: Dashboard Frontend — UI Components & Charts

## Objective
Implement Dashboard UI with KPI cards, charts, and real-time data visualization.

---

## Context

Backend sudah ready (Phase 1):
- `GET /api/dashboard/summary` — KPI data
- `GET /api/dashboard/trend` — Line chart data
- `GET /api/dashboard/pareto` — Bar chart data
- `GET /api/dashboard/heatmap` — Heatmap data
- `GET /api/defect-classes` — Defect types master

Tech stack: Next.js 14 App Router, JavaScript, Tailwind CSS
Chart library: Recharts (sudah installed) atau install jika belum

---

## Task 1: Create Dashboard Hooks

### 1.1 `hooks/useDashboard.js`

```javascript
import { useState, useEffect, useCallback } from 'react'

export function useDashboardSummary({ sectionId, lineId, refreshInterval = 5000 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (sectionId) params.append('section_id', sectionId)
      if (lineId) params.append('line_id', lineId)
      
      const res = await fetch(`/api/dashboard/summary?${params}`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [sectionId, lineId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  return { data, loading, error, refetch: fetchData }
}

export function useDashboardTrend({ sectionId, lineId, days = 7 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ days: days.toString() })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)
        
        const res = await fetch(`/api/dashboard/trend?${params}`)
        if (!res.ok) throw new Error('Failed to fetch trend')
        setData(await res.json())
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days])

  return { data, loading, error }
}

export function useDashboardPareto({ sectionId, lineId, days = 30, limit = 10 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ days: days.toString(), limit: limit.toString() })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)
        
        const res = await fetch(`/api/dashboard/pareto?${params}`)
        if (!res.ok) throw new Error('Failed to fetch pareto')
        setData(await res.json())
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days, limit])

  return { data, loading, error }
}

export function useDashboardHeatmap({ sectionId, lineId, days = 7 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ days: days.toString() })
        if (sectionId) params.append('section_id', sectionId)
        if (lineId) params.append('line_id', lineId)
        
        const res = await fetch(`/api/dashboard/heatmap?${params}`)
        if (!res.ok) throw new Error('Failed to fetch heatmap')
        setData(await res.json())
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sectionId, lineId, days])

  return { data, loading, error }
}
```

---

## Task 2: Create UI Components

### 2.1 `components/dashboard/KPICard.jsx`

```javascript
export function KPICard({ 
  title, 
  value, 
  unit = '', 
  trend = null, // { value: 5.2, direction: 'up' | 'down' }
  icon: Icon,
  color = 'blue', // blue, green, red, yellow
  loading = false 
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  }

  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
  }

  if (loading) {
    return (
      <div className={`rounded-xl border p-6 ${colorClasses[color]} animate-pulse`}>
        <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
        <div className="h-8 w-16 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{title}</span>
        {Icon && <Icon className="w-5 h-5 opacity-60" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold">{value}</span>
        {unit && <span className="text-sm opacity-60 mb-1">{unit}</span>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${trendColors[trend.direction]}`}>
          {trend.direction === 'up' ? '↑' : '↓'}
          <span>{trend.value}%</span>
          <span className="opacity-60">vs yesterday</span>
        </div>
      )}
    </div>
  )
}
```

### 2.2 `components/dashboard/KPIGrid.jsx`

```javascript
import { KPICard } from './KPICard'
import { 
  ClipboardCheck, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Percent,
  Clock
} from 'lucide-react' // atau icon library yang dipakai

export function KPIGrid({ data, loading }) {
  const cards = [
    {
      title: 'Total Inspected',
      value: data?.total_inspected?.toLocaleString() || '0',
      icon: ClipboardCheck,
      color: 'blue'
    },
    {
      title: 'Pass',
      value: data?.total_pass?.toLocaleString() || '0',
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: 'Defects Found',
      value: data?.total_defect?.toLocaleString() || '0',
      icon: AlertTriangle,
      color: 'red'
    },
    {
      title: 'False Calls',
      value: data?.total_false_call?.toLocaleString() || '0',
      icon: XCircle,
      color: 'yellow'
    },
    {
      title: 'Yield Rate',
      value: data?.yield_rate || '0',
      unit: '%',
      icon: Percent,
      color: 'green'
    },
    {
      title: 'Defect Rate',
      value: data?.defect_rate || '0',
      unit: '%',
      icon: AlertTriangle,
      color: 'red'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, idx) => (
        <KPICard key={idx} {...card} loading={loading} />
      ))}
    </div>
  )
}
```

### 2.3 `components/dashboard/DefectTrendChart.jsx`

```javascript
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'

export function DefectTrendChart({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Defect Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
            labelFormatter={(date) => new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="total_defect" 
            name="Defects"
            stroke="#EF4444" 
            strokeWidth={2}
            dot={{ fill: '#EF4444', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="defect_rate" 
            name="Defect Rate (%)"
            stroke="#F59E0B" 
            strokeWidth={2}
            dot={{ fill: '#F59E0B', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 2.4 `components/dashboard/DefectPareto.jsx`

```javascript
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'

export function DefectPareto({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  const severityColors = {
    critical: '#DC2626',
    major: '#F97316',
    minor: '#FBBF24',
    cosmetic: '#6B7280'
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Top Defect Types (Pareto)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis 
            type="category" 
            dataKey="defect_name" 
            tick={{ fontSize: 12 }}
            width={120}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
            formatter={(value, name) => [value, name === 'count' ? 'Count' : name]}
          />
          <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
            {data?.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || severityColors[entry.severity] || '#3B82F6'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center text-sm">
        {Object.entries(severityColors).map(([severity, color]) => (
          <div key={severity} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
            <span className="capitalize">{severity}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 2.5 `components/dashboard/DefectHeatmap.jsx`

```javascript
import { useRef, useEffect } from 'react'

export function DefectHeatmap({ data, loading, pcbWidth = 400, pcbHeight = 300 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (loading || !canvasRef.current || !data?.length) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Clear canvas
    ctx.clearRect(0, 0, pcbWidth, pcbHeight)
    
    // Draw PCB outline
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.strokeRect(10, 10, pcbWidth - 20, pcbHeight - 20)
    
    // Draw grid
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 0.5
    for (let x = 30; x < pcbWidth - 10; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 10)
      ctx.lineTo(x, pcbHeight - 10)
      ctx.stroke()
    }
    for (let y = 30; y < pcbHeight - 10; y += 20) {
      ctx.beginPath()
      ctx.moveTo(10, y)
      ctx.lineTo(pcbWidth - 10, y)
      ctx.stroke()
    }
    
    // Find max count for normalization
    const maxCount = Math.max(...data.map(d => d.count), 1)
    
    // Draw defect hotspots
    data.forEach(point => {
      const intensity = point.count / maxCount
      const radius = 8 + (intensity * 12)
      
      // Gradient from yellow to red based on intensity
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      )
      gradient.addColorStop(0, `rgba(239, 68, 68, ${0.6 + intensity * 0.4})`)
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    })
  }, [data, loading, pcbWidth, pcbHeight])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Defect Location Heatmap</h3>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={pcbWidth}
          height={pcbHeight}
          className="border border-gray-200 rounded bg-gray-50"
        />
      </div>
      <div className="flex justify-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-red-600"></div>
          <span>High</span>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 3: Create Dashboard Page

### 3.1 `app/(dashboard)/dashboard/page.jsx`

```javascript
'use client'

import { useState } from 'react'
import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { DefectTrendChart } from '@/components/dashboard/DefectTrendChart'
import { DefectPareto } from '@/components/dashboard/DefectPareto'
import { DefectHeatmap } from '@/components/dashboard/DefectHeatmap'
import { 
  useDashboardSummary, 
  useDashboardTrend, 
  useDashboardPareto,
  useDashboardHeatmap 
} from '@/hooks/useDashboard'

export default function DashboardPage() {
  const [sectionId, setSectionId] = useState(null)
  const [lineId, setLineId] = useState(null)
  const [trendDays, setTrendDays] = useState(7)

  const { data: summary, loading: summaryLoading } = useDashboardSummary({ 
    sectionId, 
    lineId,
    refreshInterval: 5000 // refresh every 5s
  })
  
  const { data: trend, loading: trendLoading } = useDashboardTrend({ 
    sectionId, 
    lineId, 
    days: trendDays 
  })
  
  const { data: pareto, loading: paretoLoading } = useDashboardPareto({ 
    sectionId, 
    lineId 
  })
  
  const { data: heatmap, loading: heatmapLoading } = useDashboardHeatmap({ 
    sectionId, 
    lineId 
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Real-time inspection overview</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-4">
          <select 
            className="border rounded-lg px-3 py-2 text-sm"
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid data={summary} loading={summaryLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DefectTrendChart data={trend} loading={trendLoading} />
        <DefectPareto data={pareto} loading={paretoLoading} />
      </div>

      {/* Heatmap */}
      <DefectHeatmap data={heatmap} loading={heatmapLoading} />
    </div>
  )
}
```

---

## Task 4: Install Dependencies (jika belum ada)

```bash
npm install recharts lucide-react
```

---

## Verification Checklist

1. [ ] Dashboard page loads tanpa error
2. [ ] KPI cards menampilkan data (atau 0 jika kosong)
3. [ ] KPI cards auto-refresh setiap 5 detik
4. [ ] Line chart menampilkan trend
5. [ ] Bar chart menampilkan pareto
6. [ ] Heatmap menampilkan defect locations
7. [ ] Filter days bekerja
8. [ ] Loading states muncul saat fetch

---

## Notes

- Gunakan existing layout dan styling yang sudah ada di project
- Sesuaikan path import jika berbeda dengan struktur project
- Jika recharts belum diinstall, install dulu
- Components bisa di-export dari index file untuk cleaner imports

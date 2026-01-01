'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Radio,
  Cpu
} from 'lucide-react'
import {
  useDashboardSummary,
  useDashboardTrend,
  useDashboardPareto,
  useDashboardHeatmap
} from '@/hooks/useDashboard'

// Data Readout Component
function DataReadout({ label, value, unit, trend, status, size = 'default' }) {
  const statusColors = {
    ok: 'text-phosphor-green',
    warning: 'text-phosphor-amber',
    error: 'text-phosphor-red',
    neutral: 'text-phosphor-amber'
  }

  const sizeClasses = {
    small: 'text-xl',
    default: 'text-3xl',
    large: 'text-5xl'
  }

  return (
    <div className="data-readout">
      <div className="data-label">{label}</div>
      <div className="flex items-end gap-2">
        <span className={`data-value ${statusColors[status || 'neutral']} ${sizeClasses[size]}`}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-sm text-text-tertiary mb-1">{unit}</span>
        )}
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs mb-1 ${trend >= 0 ? 'text-phosphor-green' : 'text-phosphor-red'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

// KPI Card Component
function KPICard({ title, code, value, subtitle, icon: Icon, status, trend }) {
  const statusConfig = {
    ok: { border: 'border-phosphor-green/30', glow: 'shadow-glow-green', text: 'text-phosphor-green', bg: 'bg-phosphor-green/5' },
    warning: { border: 'border-phosphor-amber/30', glow: '', text: 'text-phosphor-amber', bg: 'bg-phosphor-amber/5' },
    error: { border: 'border-phosphor-red/30', glow: 'shadow-glow-red', text: 'text-phosphor-red', bg: 'bg-phosphor-red/5' },
    neutral: { border: 'border-surface-border', glow: '', text: 'text-phosphor-amber', bg: '' }
  }

  const config = statusConfig[status || 'neutral']

  return (
    <div className={`panel ${config.border} ${config.glow}`}>
      <div className="panel-header">
        <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
          {code}
        </span>
        <span>{title}</span>
      </div>
      <div className={`p-4 ${config.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className={`font-mono text-4xl font-bold ${config.text} text-glow-amber`}>
              {value}
            </div>
            {subtitle && (
              <p className="font-mono text-xs text-text-tertiary mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={`w-12 h-12 border ${config.border} flex items-center justify-center ${config.bg}`}>
              <Icon className={`w-6 h-6 ${config.text}`} />
            </div>
          )}
        </div>
        {trend !== undefined && (
          <div className="mt-3 pt-3 border-t border-surface-border flex items-center gap-2">
            {trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-phosphor-green" />
            ) : (
              <TrendingDown className="w-4 h-4 text-phosphor-red" />
            )}
            <span className={`font-mono text-sm ${trend >= 0 ? 'text-phosphor-green' : 'text-phosphor-red'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <span className="font-mono text-xs text-text-tertiary">vs last period</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Status Bar Component
function SystemStatusBar({ data, loading }) {
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-terminal border border-surface-border p-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-phosphor-green animate-pulse" />
          <span className="font-mono text-sm text-phosphor-green">SYSTEM ONLINE</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div className="status-indicator ok" />
            <span className="text-text-tertiary">AI MODEL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="status-indicator ok" />
            <span className="text-text-tertiary">CAMERA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="status-indicator ok" />
            <span className="text-text-tertiary">DATABASE</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-tertiary">
          LAST UPDATE: {loading ? '...' : 'NOW'}
        </span>
        <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>
      </div>
    </div>
  )
}

// Mini Chart Component (simplified bar chart)
function MiniBarChart({ data, maxValue }) {
  if (!data || data.length === 0) return null
  const max = maxValue || Math.max(...data.map(d => d.value))

  return (
    <div className="flex items-end gap-1 h-16">
      {data.slice(-12).map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-phosphor-amber/80 min-h-[2px] transition-all"
            style={{ height: `${(item.value / max) * 100}%` }}
          />
          <span className="font-mono text-xxs text-text-tertiary">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// Defect Type Row
function DefectTypeRow({ rank, name, count, percentage, maxCount }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
      <span className="font-mono text-xs text-text-tertiary w-6">#{rank}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-display text-sm text-text-primary">{name}</span>
          <span className="font-mono text-sm text-phosphor-amber">{count}</span>
        </div>
        <div className="h-1.5 bg-void border border-surface-border">
          <div
            className="h-full bg-phosphor-amber transition-all"
            style={{ width: `${(count / maxCount) * 100}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-xs text-text-tertiary w-12 text-right">{percentage}%</span>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [sectionId, setSectionId] = useState(null)
  const [lineId, setLineId] = useState(null)
  const [trendDays, setTrendDays] = useState(7)

  const {
    data: summary,
    loading: summaryLoading,
    refetch: refetchSummary
  } = useDashboardSummary({
    sectionId,
    lineId,
    refreshInterval: 5000
  })

  const { data: trend, loading: trendLoading } = useDashboardTrend({
    sectionId,
    lineId,
    days: trendDays
  })

  const { data: pareto, loading: paretoLoading } = useDashboardPareto({
    sectionId,
    lineId,
    days: 30
  })

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="panel p-8 text-center">
          <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm text-text-tertiary">LOADING DASHBOARD...</p>
        </div>
      </div>
    )
  }

  // Calculate derived values
  const totalInspected = (summary?.passed || 0) + (summary?.failed || 0)
  const yieldRate = totalInspected > 0 ? ((summary?.passed / totalInspected) * 100).toFixed(1) : '0.0'
  const yieldStatus = parseFloat(yieldRate) >= 95 ? 'ok' : parseFloat(yieldRate) >= 90 ? 'warning' : 'error'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Radio className="w-5 h-5 text-phosphor-amber" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-text-primary">
              COMMAND DASHBOARD
            </h1>
          </div>
          <p className="font-mono text-sm text-text-tertiary">
            SYS://INDUSIA.HMI.DASHBOARD // REAL-TIME ANALYTICS
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            className="bg-terminal border border-surface-border px-3 py-2 font-mono text-sm text-text-primary focus:border-phosphor-amber transition-colors"
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
          >
            <option value={7}>LAST 7 DAYS</option>
            <option value={14}>LAST 14 DAYS</option>
            <option value={30}>LAST 30 DAYS</option>
          </select>

          {/* Refresh button */}
          <button
            onClick={refetchSummary}
            className="btn-ghost px-3 py-2 flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
            <span className="font-display text-xs tracking-wider">REFRESH</span>
          </button>
        </div>
      </div>

      {/* System Status Bar */}
      <SystemStatusBar data={summary} loading={summaryLoading} />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="TOTAL INSPECTED"
          code="INS"
          value={totalInspected.toLocaleString()}
          subtitle="boards processed"
          icon={Target}
          status="neutral"
          trend={5.2}
        />
        <KPICard
          title="YIELD RATE"
          code="YLD"
          value={`${yieldRate}%`}
          subtitle="pass rate"
          icon={CheckCircle2}
          status={yieldStatus}
          trend={yieldStatus === 'ok' ? 1.2 : -0.8}
        />
        <KPICard
          title="DEFECTS FOUND"
          code="DEF"
          value={(summary?.failed || 0).toLocaleString()}
          subtitle="total failures"
          icon={XCircle}
          status={summary?.failed > 100 ? 'error' : 'warning'}
        />
        <KPICard
          title="PENDING REVIEW"
          code="REV"
          value={(summary?.pending || 0).toLocaleString()}
          subtitle="awaiting decision"
          icon={Clock}
          status={summary?.pending > 50 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Panel */}
        <div className="panel">
          <div className="panel-header">
            <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
              TRD
            </span>
            <span>Inspection Trend</span>
            <span className="ml-auto font-mono text-xxs text-text-tertiary">{trendDays}D</span>
          </div>
          <div className="p-4">
            {trendLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-phosphor-amber border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <MiniBarChart
                  data={trend?.map((d, i) => ({
                    label: `D${i + 1}`,
                    value: d.total || 0
                  })) || []}
                />
                <div className="mt-4 pt-4 border-t border-surface-border grid grid-cols-3 gap-4">
                  <div>
                    <span className="data-label">AVG/DAY</span>
                    <span className="font-mono text-lg text-phosphor-amber">
                      {trend?.length > 0
                        ? Math.round(trend.reduce((a, b) => a + (b.total || 0), 0) / trend.length)
                        : 0}
                    </span>
                  </div>
                  <div>
                    <span className="data-label">PEAK</span>
                    <span className="font-mono text-lg text-phosphor-green">
                      {trend?.length > 0 ? Math.max(...trend.map(t => t.total || 0)) : 0}
                    </span>
                  </div>
                  <div>
                    <span className="data-label">LOW</span>
                    <span className="font-mono text-lg text-phosphor-red">
                      {trend?.length > 0 ? Math.min(...trend.map(t => t.total || 0)) : 0}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pareto Panel */}
        <div className="panel">
          <div className="panel-header">
            <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
              PAR
            </span>
            <span>Defect Pareto</span>
            <span className="ml-auto font-mono text-xxs text-text-tertiary">TOP 5</span>
          </div>
          <div className="p-4">
            {paretoLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-phosphor-amber border-t-transparent animate-spin" />
              </div>
            ) : pareto?.length > 0 ? (
              <div>
                {pareto.slice(0, 5).map((item, i) => (
                  <DefectTypeRow
                    key={item.defect_type}
                    rank={i + 1}
                    name={item.defect_type}
                    count={item.count}
                    percentage={item.percentage}
                    maxCount={pareto[0].count}
                  />
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center">
                <span className="font-mono text-sm text-text-tertiary">NO DATA AVAILABLE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="panel">
        <div className="panel-header">
          <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
            SYS
          </span>
          <span>System Metrics</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <DataReadout label="CPU LOAD" value="42" unit="%" status="ok" size="small" />
          <DataReadout label="MEMORY" value="68" unit="%" status="ok" size="small" />
          <DataReadout label="AI LATENCY" value="23" unit="ms" status="ok" size="small" />
          <DataReadout label="QUEUE SIZE" value="12" status="ok" size="small" />
          <DataReadout label="THROUGHPUT" value="847" unit="/hr" status="ok" size="small" />
          <DataReadout label="UPTIME" value="99.9" unit="%" status="ok" size="small" />
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-phosphor-green animate-pulse-glow" />
          <span className="font-mono text-xs text-text-tertiary">LIVE DATA FEED ACTIVE</span>
        </div>
        <span className="text-text-tertiary">|</span>
        <span className="font-mono text-xs text-text-tertiary">
          AUTO-REFRESH: 5s INTERVAL
        </span>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  RefreshCw,
  Radio,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import {
  useDashboardSummary,
  useDashboardTrend,
  useDashboardPareto,
} from '@/hooks/useDashboard'
import { useI18n } from '@/context/I18nContext'
import PageLoading from '@/components/common/PageLoading'

// Data Readout Component
function DataReadout({ label, value, unit, status, size = 'default', loading }) {
  const statusColors = {
    ok: 'text-phosphor-green',
    warning: 'text-phosphor-teal',
    error: 'text-phosphor-red',
    neutral: 'text-phosphor-teal'
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
        {loading ? (
          <span className="font-mono text-xl text-text-tertiary">--</span>
        ) : (
          <span className={`data-value ${statusColors[status || 'neutral']} ${sizeClasses[size]}`}>
            {value}
          </span>
        )}
        {unit && (
          <span className="font-mono text-sm text-text-tertiary mb-1">{unit}</span>
        )}
      </div>
    </div>
  )
}

// KPI Card Component
function KPICard({ title, code, value, subtitle, icon: Icon, status, loading }) {
  const statusConfig = {
    ok: { border: 'border-phosphor-green/30', glow: 'shadow-glow-green', text: 'text-phosphor-green', bg: 'bg-phosphor-green/5' },
    warning: { border: 'border-phosphor-teal/30', glow: '', text: 'text-phosphor-teal', bg: 'bg-phosphor-teal/5' },
    error: { border: 'border-phosphor-red/30', glow: 'shadow-glow-red', text: 'text-phosphor-red', bg: 'bg-phosphor-red/5' },
    neutral: { border: 'border-surface-border', glow: '', text: 'text-phosphor-teal', bg: '' }
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
            {loading ? (
              <Loader2 className="w-8 h-8 text-text-tertiary animate-spin" />
            ) : (
              <div className={`font-mono text-4xl font-bold ${config.text} text-glow-teal`}>
                {value}
              </div>
            )}
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
      </div>
    </div>
  )
}

// Status Bar Component - Uses Real System Health
function SystemStatusBar({ loading }) {
  const { statuses, STATE_TYPES } = useSystemHealth()
  const [currentTime, setCurrentTime] = useState('')
  const { t } = useI18n()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const getStatusClass = (state) => {
    switch (state) {
      case STATE_TYPES?.OK: return 'ok'
      case STATE_TYPES?.WARNING: return 'warning'
      case STATE_TYPES?.ERROR:
      case STATE_TYPES?.OFFLINE: return 'error'
      default: return 'warning'
    }
  }

  const overallStatus = () => {
    const states = Object.values(statuses || {}).map(s => s.state)
    if (states.includes(STATE_TYPES?.ERROR) || states.includes(STATE_TYPES?.OFFLINE)) {
      return { text: t('dashboard.degraded'), class: 'text-phosphor-red' }
    }
    if (states.includes(STATE_TYPES?.WARNING)) {
      return { text: t('dashboard.warning'), class: 'text-phosphor-teal' }
    }
    return { text: t('dashboard.systemOnline'), class: 'text-phosphor-green' }
  }

  const status = overallStatus()

  return (
    <div className="bg-terminal border border-surface-border p-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${status.class} animate-pulse`} />
          <span className={`font-mono text-sm ${status.class}`}>{status.text}</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div className={`status-indicator ${getStatusClass(statuses?.aiModel?.state)}`} />
            <span className="text-text-tertiary">{t('dashboard.aiModel')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`status-indicator ${getStatusClass(statuses?.camera?.state)}`} />
            <span className="text-text-tertiary">{t('dashboard.camera')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`status-indicator ${getStatusClass(statuses?.database?.state)}`} />
            <span className="text-text-tertiary">{t('dashboard.database')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`status-indicator ${getStatusClass(statuses?.cloud?.state)}`} />
            <span className="text-text-tertiary">{t('dashboard.cloud')}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-tertiary">
          {t('dashboard.lastUpdate')}: {loading ? '...' : t('dashboard.now')}
        </span>
        <span className="font-mono text-sm text-phosphor-teal">{currentTime}</span>
      </div>
    </div>
  )
}

// Mini Chart Component
function MiniBarChart({ data, maxValue }) {
  if (!data || data.length === 0) return null
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  return (
    <div className="flex items-end gap-1 h-16">
      {data.slice(-12).map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-phosphor-teal/80 min-h-[2px] transition-all"
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
          <span className="font-mono text-sm text-phosphor-teal">{count}</span>
        </div>
        <div className="h-1.5 bg-void border border-surface-border">
          <div
            className="h-full bg-phosphor-teal transition-all"
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
  const { statuses, loading: healthLoading } = useSystemHealth()
  const [sectionId, setSectionId] = useState(null)
  const [lineId, setLineId] = useState(null)
  const [trendDays, setTrendDays] = useState(7)
  const { t } = useI18n()

  const {
    data: summary,
    loading: summaryLoading,
    refetch: refetchSummary
  } = useDashboardSummary({
    sectionId,
    lineId,
    refreshInterval: 30000
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
    return <PageLoading message={t('dashboard.loading')} />
  }

  // Calculate derived values from API data
  const totalInspected = (summary?.totalInspected || summary?.passed || 0) + (summary?.totalDefect || summary?.failed || 0)
  const passed = summary?.totalPass || summary?.passed || 0
  const failed = summary?.totalDefect || summary?.failed || 0
  const pending = summary?.pending || 0
  
  const yieldRate = totalInspected > 0 ? ((passed / totalInspected) * 100).toFixed(1) : '0.0'
  const yieldStatus = parseFloat(yieldRate) >= 95 ? 'ok' : parseFloat(yieldRate) >= 90 ? 'warning' : 'error'

  // Get last sync info from system health
  const lastSyncInfo = statuses?.lastSync?.details || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Radio className="w-5 h-5 text-phosphor-teal" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-text-primary">
              {t('dashboard.title')}
            </h1>
          </div>
          <p className="font-mono text-sm text-text-tertiary">
            SYS://INDUSIA.HMI.DASHBOARD // {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="bg-terminal border border-surface-border px-3 py-2 font-mono text-sm text-text-primary focus:border-phosphor-teal transition-colors"
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
          >
            <option value={7}>{t('dashboard.last7Days')}</option>
            <option value={14}>{t('dashboard.last14Days')}</option>
            <option value={30}>{t('dashboard.last30Days')}</option>
          </select>

          <button
            onClick={refetchSummary}
            className="btn-ghost px-3 py-2 flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
            <span className="font-display text-xs tracking-wider">{t('dashboard.refresh')}</span>
          </button>
        </div>
      </div>

      {/* System Status Bar - Real Data */}
      <SystemStatusBar loading={summaryLoading} />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('dashboard.totalInspected')}
          code="INS"
          value={totalInspected.toLocaleString()}
          subtitle={t('dashboard.boardsProcessed')}
          icon={Target}
          status="neutral"
          loading={summaryLoading}
        />
        <KPICard
          title={t('dashboard.yieldRate')}
          code="YLD"
          value={`${yieldRate}%`}
          subtitle={t('dashboard.passRate')}
          icon={CheckCircle2}
          status={yieldStatus}
          loading={summaryLoading}
        />
        <KPICard
          title={t('dashboard.defectsFound')}
          code="DEF"
          value={failed.toLocaleString()}
          subtitle={t('dashboard.totalFailures')}
          icon={XCircle}
          status={failed > 100 ? 'error' : (failed > 0 ? 'warning' : 'ok')}
          loading={summaryLoading}
        />
        <KPICard
          title={t('dashboard.pendingReview')}
          code="REV"
          value={pending.toLocaleString()}
          subtitle={t('dashboard.awaitingDecision')}
          icon={Clock}
          status={pending > 50 ? 'warning' : 'neutral'}
          loading={summaryLoading}
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
            <span>{t('dashboard.inspectionTrend')}</span>
            <span className="ml-auto font-mono text-xxs text-text-tertiary">{trendDays}D</span>
          </div>
          <div className="p-4">
            {trendLoading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-phosphor-teal animate-spin" />
              </div>
            ) : trend?.length > 0 ? (
              <>
                <MiniBarChart
                  data={trend.map((d, i) => ({
                    label: `D${i + 1}`,
                    value: d.total || d.totalInspected || 0
                  }))}
                />
                <div className="mt-4 pt-4 border-t border-surface-border grid grid-cols-3 gap-4">
                  <div>
                    <span className="data-label">{t('dashboard.avgPerDay')}</span>
                    <span className="font-mono text-lg text-phosphor-teal">
                      {Math.round(trend.reduce((a, b) => a + (b.total || b.totalInspected || 0), 0) / trend.length)}
                    </span>
                  </div>
                  <div>
                    <span className="data-label">{t('dashboard.peak')}</span>
                    <span className="font-mono text-lg text-phosphor-green">
                      {Math.max(...trend.map(t => t.total || t.totalInspected || 0))}
                    </span>
                  </div>
                  <div>
                    <span className="data-label">{t('dashboard.low')}</span>
                    <span className="font-mono text-lg text-phosphor-red">
                      {Math.min(...trend.map(t => t.total || t.totalInspected || 0))}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6 text-text-tertiary" />
                <span className="font-mono text-sm text-text-tertiary">{t('dashboard.noTrendData')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pareto Panel */}
        <div className="panel">
          <div className="panel-header">
            <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
              PAR
            </span>
            <span>{t('dashboard.defectPareto')}</span>
            <span className="ml-auto font-mono text-xxs text-text-tertiary">{t('dashboard.top5')}</span>
          </div>
          <div className="p-4">
            {paretoLoading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-phosphor-teal animate-spin" />
              </div>
            ) : pareto?.length > 0 ? (
              <div>
                {pareto.slice(0, 5).map((item, i) => (
                  <DefectTypeRow
                    key={item.defect_type || item.defectType || i}
                    rank={i + 1}
                    name={item.defect_type || item.defectType || 'Unknown'}
                    count={item.count || 0}
                    percentage={item.percentage || 0}
                    maxCount={pareto[0]?.count || 1}
                  />
                ))}
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6 text-text-tertiary" />
                <span className="font-mono text-sm text-text-tertiary">{t('dashboard.noDefectData')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Panel */}
      <div className="panel">
        <div className="panel-header">
          <span className="font-mono text-xxs px-1.5 py-0.5 border border-surface-border bg-void text-text-tertiary">
            SYN
          </span>
          <span>{t('dashboard.syncStatus')}</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <DataReadout
            label={t('dashboard.lastSync')}
            value={lastSyncInfo.minutesAgo ? `${lastSyncInfo.minutesAgo}m ago` : '--'} 
            status={statuses?.lastSync?.state === 'ok' ? 'ok' : 'warning'} 
            size="small" 
            loading={healthLoading}
          />
          <DataReadout
            label={t('dashboard.syncedRecords')}
            value={lastSyncInfo.syncedRecords || 0} 
            status="ok" 
            size="small" 
            loading={healthLoading}
          />
          <DataReadout
            label={t('dashboard.failed')}
            value={lastSyncInfo.failedRecords || 0} 
            status={lastSyncInfo.failedRecords > 0 ? 'error' : 'ok'} 
            size="small" 
            loading={healthLoading}
          />
          <DataReadout
            label={t('dashboard.duration')}
            value={lastSyncInfo.durationMs ? `${(lastSyncInfo.durationMs / 1000).toFixed(1)}s` : '--'} 
            status="ok" 
            size="small" 
            loading={healthLoading}
          />
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-phosphor-green animate-pulse-glow" />
          <span className="font-mono text-xs text-text-tertiary">{t('dashboard.liveDataFeed')}</span>
        </div>
        <span className="text-text-tertiary">|</span>
        <span className="font-mono text-xs text-text-tertiary">
          {t('dashboard.autoRefresh')}
        </span>
      </div>
    </div>
  )
}

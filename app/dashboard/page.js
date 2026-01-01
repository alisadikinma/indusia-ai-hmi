'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import SectionHeader from '@/components/common/SectionHeader'
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
import { RefreshCw } from 'lucide-react'

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
    refreshInterval: 5000 // refresh every 5s
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

  const { data: heatmap, loading: heatmapLoading } = useDashboardHeatmap({
    sectionId,
    lineId,
    days: trendDays
  })

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Dashboard"
          description="Real-time inspection overview and analytics"
        />

        {/* Filters */}
        <div className="flex items-center gap-4">
          <select
            className="bg-indusia-surface border border-indusia-border rounded-lg px-3 py-2 text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>

          <button
            onClick={refetchSummary}
            className="p-2 bg-indusia-surface border border-indusia-border rounded-lg text-indusia-textMuted hover:text-indusia-primary hover:border-indusia-primary transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-indusia-textMuted">
        <div className="w-2 h-2 rounded-full bg-indusia-pass animate-pulse"></div>
        <span>KPIs auto-refresh every 5 seconds</span>
      </div>
    </div>
  )
}

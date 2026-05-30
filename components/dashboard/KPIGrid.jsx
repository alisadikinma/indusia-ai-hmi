/**
 * KPI Grid Component
 * Displays a grid of KPI cards for dashboard overview
 */

import { KPICard } from './KPICard'
import {
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Percent,
  TrendingUp
} from 'lucide-react'

export function KPIGrid({ data, loading }) {
  const cards = [
    {
      title: 'Total Inspected',
      value: data?.totalInspected?.toLocaleString() || '0',
      icon: ClipboardCheck,
      variant: 'primary'
    },
    {
      title: 'Pass',
      value: data?.totalPass?.toLocaleString() || '0',
      icon: CheckCircle,
      variant: 'success'
    },
    {
      title: 'Defects Found',
      value: data?.totalDefect?.toLocaleString() || '0',
      icon: AlertTriangle,
      variant: 'danger'
    },
    {
      title: 'False Calls',
      value: data?.totalFalseCall?.toLocaleString() || '0',
      icon: XCircle,
      variant: 'warning'
    },
    {
      title: 'Yield Rate',
      value: data?.yieldRate || '0',
      unit: '%',
      icon: TrendingUp,
      variant: 'success'
    },
    {
      title: 'Defect Rate',
      value: data?.defectRate || '0',
      unit: '%',
      icon: Percent,
      variant: 'danger'
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

export default KPIGrid

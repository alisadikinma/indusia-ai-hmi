/**
 * KPI Card Component
 * Displays a single KPI metric with optional trend indicator
 */

import { cn } from '@/lib/utils'

export function KPICard({
  title,
  value,
  unit = '',
  trend = null, // { value: 5.2, direction: 'up' | 'down' }
  icon: Icon,
  variant = 'default', // default, success, danger, warning, primary
  loading = false
}) {
  const variantClasses = {
    default: 'bg-indusia-surface border-indusia-border',
    success: 'bg-indusia-pass/10 border-indusia-pass/30',
    danger: 'bg-indusia-fail/10 border-indusia-fail/30',
    warning: 'bg-indusia-warning/10 border-indusia-warning/30',
    primary: 'bg-indusia-primary/10 border-indusia-primary/30',
  }

  const iconClasses = {
    default: 'text-indusia-textMuted',
    success: 'text-indusia-pass',
    danger: 'text-indusia-fail',
    warning: 'text-indusia-warning',
    primary: 'text-indusia-primary',
  }

  const valueClasses = {
    default: 'text-indusia-text',
    success: 'text-indusia-pass',
    danger: 'text-indusia-fail',
    warning: 'text-indusia-warning',
    primary: 'text-indusia-primary',
  }

  const trendColors = {
    up: 'text-indusia-pass',
    down: 'text-indusia-fail',
  }

  if (loading) {
    return (
      <div className={cn('rounded-xl border p-5', variantClasses[variant])}>
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-indusia-border rounded mb-3"></div>
          <div className="h-8 w-20 bg-indusia-border rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border p-5', variantClasses[variant])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-indusia-textMuted">{title}</span>
        {Icon && <Icon className={cn('w-5 h-5', iconClasses[variant])} />}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('text-3xl font-bold', valueClasses[variant])}>
          {value}
        </span>
        {unit && (
          <span className="text-sm text-indusia-textMuted mb-1">{unit}</span>
        )}
      </div>
      {trend && (
        <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColors[trend.direction])}>
          {trend.direction === 'up' ? '↑' : '↓'}
          <span>{trend.value}%</span>
          <span className="text-indusia-textMuted">vs yesterday</span>
        </div>
      )}
    </div>
  )
}

export default KPICard

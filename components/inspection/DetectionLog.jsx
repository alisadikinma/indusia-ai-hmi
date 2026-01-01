'use client'

/**
 * Detection Log Component
 * Scrollable list of recent inspection detections
 */

import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'

export function DetectionLog({ items = [], onItemClick, maxHeight = 'auto' }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const resultConfig = {
    pass: {
      icon: CheckCircle,
      color: 'text-indusia-pass',
      bg: 'bg-indusia-pass/10',
      border: 'border-indusia-pass/30'
    },
    fail: {
      icon: XCircle,
      color: 'text-indusia-fail',
      bg: 'bg-indusia-fail/10',
      border: 'border-indusia-fail/30'
    },
    review: {
      icon: AlertCircle,
      color: 'text-indusia-warning',
      bg: 'bg-indusia-warning/10',
      border: 'border-indusia-warning/30'
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-indusia-textMuted">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <div className="text-sm">No detections yet</div>
        <div className="text-xs mt-1">Waiting for inspection data...</div>
      </div>
    )
  }

  return (
    <div
      className="divide-y divide-indusia-border overflow-y-auto"
      style={{ maxHeight }}
    >
      {items.map((item, idx) => {
        const config = resultConfig[item.result] || resultConfig.review
        const Icon = config.icon
        const defectCount = item.detections?.length || 0

        return (
          <div
            key={item.frame_id || idx}
            onClick={() => onItemClick?.(item)}
            className={cn(
              'p-3 cursor-pointer transition-colors',
              config.bg,
              'hover:opacity-80',
              'border-l-4',
              config.border
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-indusia-textMuted">
                {formatTime(item.timestamp)}
              </span>
              <div className={cn('flex items-center gap-1', config.color)}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-bold">
                  {item.result?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Board ID */}
            <div className="text-sm font-medium text-indusia-text truncate">
              {item.board_id || 'Unknown Board'}
            </div>

            {/* Defect summary */}
            {defectCount > 0 && (
              <div className="text-xs text-indusia-textMuted mt-1 space-y-0.5">
                <div>{defectCount} defect{defectCount > 1 ? 's' : ''} detected</div>
                <div className="flex flex-wrap gap-1">
                  {item.detections?.slice(0, 3).map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-indusia-surface text-xs"
                    >
                      {d.class}
                      <span className="ml-1 opacity-60">
                        {Math.round((d.confidence || 0) * 100)}%
                      </span>
                    </span>
                  ))}
                  {defectCount > 3 && (
                    <span className="text-xs opacity-60">+{defectCount - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Inference time */}
            <div className="text-xs text-indusia-textMuted mt-1 flex items-center gap-2">
              <span>{item.inference_ms || 0}ms</span>
              {item.frame_id && (
                <span className="opacity-50 truncate max-w-[100px]">
                  {item.frame_id}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default DetectionLog

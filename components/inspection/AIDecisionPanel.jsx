'use client'

/**
 * AIDecisionPanel Component
 * Shows the overall AI decision, confidence, and defect summary
 */

import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Cpu } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'

export function AIDecisionPanel({
  decision,
  confidence,
  totalDefects,
  modelName,
  className
}) {
  const { t } = useI18n()
  const isPassing = decision === 'PASS'

  return (
    <div className={cn(
      "px-4 py-3 border-t flex-shrink-0",
      isPassing
        ? "bg-phosphor-green/5 border-phosphor-green/30"
        : "bg-phosphor-red/5 border-phosphor-red/30",
      className
    )}>
      <div className="flex items-center justify-between">
        {/* Left: AI Decision */}
        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded border",
            isPassing 
              ? "bg-phosphor-green/10 border-phosphor-green/50" 
              : "bg-phosphor-red/10 border-phosphor-red/50"
          )}>
            {isPassing ? (
              <CheckCircle className="w-6 h-6 text-phosphor-green" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-phosphor-red" />
            )}
            <span className={cn(
              "text-2xl font-display font-bold tracking-wider",
              isPassing ? "text-phosphor-green" : "text-phosphor-red"
            )}>
              {decision}
            </span>
          </div>

          {/* Confidence */}
          <div className="text-center px-3 py-1 bg-terminal border border-surface-border rounded">
            <div className="text-xxs text-text-tertiary font-mono">{t('inspection.confidence')}</div>
            <div className={cn(
              "text-lg font-mono font-bold",
              confidence >= 0.85 ? "text-phosphor-green" :
              confidence >= 0.70 ? "text-phosphor-teal" :
              "text-phosphor-red"
            )}>
              {(confidence * 100).toFixed(0)}%
            </div>
          </div>

          {/* Defect Count */}
          <div className="text-center px-3 py-1 bg-terminal border border-surface-border rounded">
            <div className="text-xxs text-text-tertiary font-mono">{t('inspection.defects')}</div>
            <div className={cn(
              "text-lg font-mono font-bold",
              totalDefects === 0 ? "text-phosphor-green" : "text-phosphor-red"
            )}>
              {totalDefects}
            </div>
          </div>
        </div>

        {/* Right: Model Info */}
        {modelName && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary font-mono">
            <Cpu className="w-4 h-4" />
            <span>{modelName}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIDecisionPanel

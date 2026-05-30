'use client'

import { useI18n } from '@/hooks/useI18n'

function StatusBadge({ status }) {
  const styles = {
    success: 'bg-phosphor-green/10 text-phosphor-green border-phosphor-green/20',
    failed: 'bg-phosphor-red/10 text-phosphor-red border-phosphor-red/20',
    in_progress: 'bg-phosphor-amber/10 text-phosphor-amber border-phosphor-amber/20 animate-pulse',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${styles[status] || styles.failed}`}>
      {status}
    </span>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * UpdateHistory
 *
 * Table showing past update attempts from update_log.
 *
 * Props:
 * - history: Array from GET /api/system/update/history
 */
export default function UpdateHistory({ history = [] }) {
  const { t } = useI18n()

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary font-mono text-xs">
        {t('systemUpdate.noHistory')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-surface-border text-text-tertiary">
            <th className="text-left py-2 px-3 font-medium">Version</th>
            <th className="text-left py-2 px-3 font-medium">Date</th>
            <th className="text-left py-2 px-3 font-medium">{t('systemUpdate.triggeredBy')}</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
            <th className="text-right py-2 px-3 font-medium">{t('systemUpdate.migrations')}</th>
          </tr>
        </thead>
        <tbody>
          {history.slice(0, 10).map((entry) => (
            <tr key={entry.id} className="border-b border-surface-border/50 hover:bg-elevated/50">
              <td className="py-2 px-3 text-text-primary">
                {entry.from_version} → {entry.to_version}
              </td>
              <td className="py-2 px-3 text-text-secondary">
                {formatDate(entry.started_at)}
              </td>
              <td className="py-2 px-3 text-text-secondary">
                {entry.triggered_by}
              </td>
              <td className="py-2 px-3">
                <StatusBadge status={entry.status} />
              </td>
              <td className="py-2 px-3 text-right text-text-secondary">
                {entry.migrations_applied || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { Loader2 } from 'lucide-react'

const STATUS_CONFIG = {
  checking: { char: '', color: 'text-text-tertiary', spinner: true },
  ok:       { char: '\u2713', color: 'text-phosphor-green', spinner: false },
  warning:  { char: '\u26A0', color: 'text-phosphor-amber', spinner: false },
  error:    { char: '\u2717', color: 'text-phosphor-red', spinner: false },
}

/**
 * PreflightCheck
 *
 * Compact list of pre-update verification checks.
 *
 * Props:
 * - checks: Array of { name, status ('checking'|'ok'|'warning'|'error'), message }
 */
export default function PreflightCheck({ checks = [] }) {
  return (
    <div className="border border-surface-border rounded-lg overflow-hidden">
      {checks.map((check, i) => {
        const config = STATUS_CONFIG[check.status] || STATUS_CONFIG.checking

        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 font-mono text-xs ${
              i < checks.length - 1 ? 'border-b border-surface-border' : ''
            }`}
          >
            {/* Status icon */}
            <span className={`w-5 flex justify-center ${config.color}`}>
              {config.spinner ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                config.char
              )}
            </span>

            {/* Check name */}
            <span className="text-text-secondary w-36 shrink-0">{check.name}</span>

            {/* Status message */}
            <span className={`${
              check.status === 'error' ? 'text-phosphor-red' :
              check.status === 'warning' ? 'text-phosphor-amber' :
              'text-text-tertiary'
            }`}>
              {check.message}
            </span>
          </div>
        )
      })}
    </div>
  )
}

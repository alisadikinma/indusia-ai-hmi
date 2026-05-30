'use client'

import { useRef, useEffect } from 'react'

const STEP_ICONS = {
  running: { char: '\u25B6', color: 'text-phosphor-amber' },   // ▶
  done:    { char: '\u2713', color: 'text-phosphor-green' },    // ✓
  failed:  { char: '\u2717', color: 'text-phosphor-red' },      // ✗
  success: { char: '\u2713', color: 'text-phosphor-green' },
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * UpdateTerminal
 *
 * CRT-styled terminal that displays update pipeline progress.
 *
 * Props:
 * - logLines: Array of { step, status, message, timestamp }
 * - isActive: Whether an update is currently in progress
 */
export default function UpdateTerminal({ logLines = [], isActive = false }) {
  const scrollRef = useRef(null)

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logLines.length])

  // Calculate progress based on pipeline steps
  const TOTAL_STEPS = 6
  const completedSteps = new Set(
    logLines.filter(l => l.status === 'done' || l.status === 'success').map(l => l.step)
  ).size

  const progressPercent = Math.round((completedSteps / TOTAL_STEPS) * 100)

  return (
    <div className="relative bg-void rounded-lg border border-surface-border overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />

      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-elevated border-b border-surface-border">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-phosphor-red/80" />
          <span className="w-3 h-3 rounded-full bg-phosphor-amber/80" />
          <span className="w-3 h-3 rounded-full bg-phosphor-green/80" />
        </div>
        <span className="font-mono text-xs text-text-tertiary ml-2">
          system-update {isActive && '— running'}
        </span>
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto p-4 font-mono text-xs leading-relaxed"
      >
        {logLines.length === 0 && (
          <div className="text-text-tertiary">Waiting for update to start...</div>
        )}

        {logLines.map((line, i) => {
          const icon = STEP_ICONS[line.status] || STEP_ICONS.running
          const isLast = i === logLines.length - 1

          return (
            <div key={i} className="flex gap-2 mb-0.5">
              <span className="text-text-tertiary shrink-0">
                [{formatTime(line.timestamp)}]
              </span>
              <span className={`shrink-0 ${icon.color}`}>
                {icon.char}
              </span>
              <span className={`${line.status === 'failed' ? 'text-phosphor-red' : 'text-text-primary'}`}>
                {line.message}
                {isLast && isActive && (
                  <span className="inline-block w-2 h-4 bg-phosphor-amber ml-0.5 animate-pulse" />
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="h-1 bg-elevated">
          <div
            className="h-full bg-phosphor-amber transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  )
}

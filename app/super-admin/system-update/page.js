'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useSystemUpdate } from '@/hooks/useSystemUpdate'
import { useI18n } from '@/hooks/useI18n'
import SectionHeader from '@/components/common/SectionHeader'
import UpdateTerminal from '@/components/system-update/UpdateTerminal'
import PreflightCheck from '@/components/system-update/PreflightCheck'
import UpdateHistory from '@/components/system-update/UpdateHistory'
import { RefreshCw, ArrowRight, AlertTriangle, CheckCircle, Download } from 'lucide-react'

export default function SystemUpdatePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useI18n()
  const {
    currentVersion,
    buildInfo,
    latestVersion,
    isUpdateAvailable,
    commitsBehind,
    changelog,
    loading: checkLoading,
    checkForUpdate,
  } = useSystemUpdate({ autoCheck: false })

  // Page state
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateComplete, setUpdateComplete] = useState(null) // 'success' | 'failed' | null
  const [logLines, setLogLines] = useState([])
  const [history, setHistory] = useState([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Preflight checks
  const [preflightChecks, setPreflightChecks] = useState([
    { name: t('systemUpdate.preflightDatabase'), status: 'checking', message: 'Checking...' },
    { name: t('systemUpdate.preflightMigrations'), status: 'checking', message: 'Checking...' },
    { name: t('systemUpdate.preflightProduction'), status: 'checking', message: 'Checking...' },
  ])

  // Auth guard
  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-panel rounded-xl shadow-xl border border-surface-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-text-primary mb-3">{t('auth.accessDenied')}</h2>
          <p className="text-sm text-text-secondary mb-6">{t('admin.onlySuperAdmin')}</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-phosphor-amber text-void rounded-lg font-medium hover:opacity-90 transition-opacity">
            {t('buttons.goBack')}
          </button>
        </div>
      </div>
    )
  }

  // Run preflight checks
  const runPreflightChecks = useCallback(async () => {
    const checks = [
      { name: t('systemUpdate.preflightDatabase'), status: 'checking', message: 'Checking...' },
      { name: t('systemUpdate.preflightMigrations'), status: 'checking', message: 'Checking...' },
      { name: t('systemUpdate.preflightProduction'), status: 'checking', message: 'Checking...' },
    ]
    setPreflightChecks([...checks])

    // Check 1: Database
    try {
      const res = await fetch('/api/system-health')
      const json = await res.json()
      checks[0] = {
        ...checks[0],
        status: json.success ? 'ok' : 'error',
        message: json.success ? 'Connected' : 'Connection failed',
      }
    } catch (_) {
      checks[0] = { ...checks[0], status: 'error', message: 'Unreachable' }
    }
    setPreflightChecks([...checks])

    // Check 2: Pending migrations
    try {
      const res = await fetch('/api/system/migrations/pending', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const json = await res.json()
      const pending = json.data?.pending?.length || 0
      checks[1] = {
        ...checks[1],
        status: pending > 0 ? 'warning' : 'ok',
        message: pending > 0
          ? t('systemUpdate.migrationsCount', { count: pending })
          : t('systemUpdate.noMigrations'),
      }
    } catch (_) {
      checks[1] = { ...checks[1], status: 'error', message: 'Check failed' }
    }
    setPreflightChecks([...checks])

    // Check 3: Production lines
    try {
      // Check a known line — if none are running, we're good
      const res = await fetch('/api/system-health')
      const json = await res.json()
      const lineRuntime = json.data?.lineRuntime
      const isRunning = lineRuntime?.state === 'ok' && lineRuntime?.details?.activeLines > 0
      checks[2] = {
        ...checks[2],
        status: isRunning ? 'error' : 'ok',
        message: isRunning
          ? t('systemUpdate.linesRunning', { count: lineRuntime.details.activeLines })
          : t('systemUpdate.allLinesIdle'),
      }
    } catch (_) {
      checks[2] = { ...checks[2], status: 'ok', message: t('systemUpdate.allLinesIdle') }
    }
    setPreflightChecks([...checks])
  }, [t, user?.id])

  // Fetch update history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/system/update/history', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const json = await res.json()
      if (json.success) {
        setHistory(json.data || [])
      }
    } catch (_) { /* ignore */ }
  }, [user?.id])

  // On mount: run checks + fetch history
  useEffect(() => {
    runPreflightChecks()
    fetchHistory()
  }, [runPreflightChecks, fetchHistory])

  // Trigger update via SSE
  const triggerUpdate = async () => {
    setShowConfirmDialog(false)
    setIsUpdating(true)
    setUpdateComplete(null)
    setLogLines([])

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({ targetVersion: latestVersion }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const events = buffer.split('\n\n')
        buffer = events.pop() // Keep incomplete event in buffer

        for (const event of events) {
          const dataLine = event.split('\n').find(l => l.startsWith('data: '))
          if (!dataLine) continue

          try {
            const data = JSON.parse(dataLine.slice(6))
            setLogLines(prev => [...prev, data])

            // Check for final event
            if (data.step === 'DONE' || data.step === 'ERROR') {
              setUpdateComplete(data.status === 'success' ? 'success' : 'failed')
              setIsUpdating(false)
              fetchHistory()
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setLogLines(prev => [...prev, {
        step: 'ERROR',
        status: 'failed',
        message: `Connection error: ${err.message}`,
        timestamp: new Date().toISOString(),
      }])
      setUpdateComplete('failed')
      setIsUpdating(false)
    }
  }

  const hasPreflightErrors = preflightChecks.some(c => c.status === 'error')

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('systemUpdate.title')}
        description={t('systemUpdate.description')}
      />

      {/* Current Version Card */}
      <div className="bg-panel rounded-lg border border-surface-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-2xl font-bold text-text-primary">
                v{currentVersion || '...'}
              </span>
              {!isUpdateAvailable && currentVersion && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-phosphor-green/10 text-phosphor-green text-xs font-mono border border-phosphor-green/20">
                  <CheckCircle className="w-3 h-3" />
                  {t('systemUpdate.upToDate')}
                </span>
              )}
              {isUpdateAvailable && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-phosphor-amber/10 text-phosphor-amber text-xs font-mono border border-phosphor-amber/20 animate-pulse">
                  <Download className="w-3 h-3" />
                  {t('systemUpdate.updateAvailable')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-6 text-xs font-mono">
              <div>
                <span className="text-text-tertiary">{t('systemUpdate.branch')}</span>
                <p className="text-text-secondary mt-0.5">{buildInfo?.branch || '—'}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Commit</span>
                <p className="text-text-secondary mt-0.5">{buildInfo?.commitHash || '—'}</p>
              </div>
              <div>
                <span className="text-text-tertiary">{t('systemUpdate.buildDate')}</span>
                <p className="text-text-secondary mt-0.5">
                  {buildInfo?.buildDate ? new Date(buildInfo.buildDate).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  }) : '—'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={checkForUpdate}
            disabled={checkLoading || isUpdating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors disabled:opacity-50 font-mono text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${checkLoading ? 'animate-spin' : ''}`} />
            {t('systemUpdate.checkNow')}
          </button>
        </div>
      </div>

      {/* Update Available Section */}
      {isUpdateAvailable && !isUpdating && updateComplete !== 'success' && (
        <div className="bg-panel rounded-lg border border-phosphor-amber/30 p-6 space-y-5">
          {/* Version comparison */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-lg text-text-secondary">v{currentVersion}</span>
            <ArrowRight className="w-5 h-5 text-phosphor-amber" />
            <span className="font-mono text-lg text-phosphor-amber font-bold">v{latestVersion}</span>
            <span className="text-xs text-text-tertiary font-mono ml-2">
              ({commitsBehind} commit{commitsBehind !== 1 ? 's' : ''})
            </span>
          </div>

          {/* Changelog */}
          {changelog.length > 0 && (
            <div>
              <h3 className="text-xs font-mono text-text-tertiary mb-2">{t('systemUpdate.changelog')}</h3>
              <ul className="space-y-1">
                {changelog.map((entry, i) => (
                  <li key={i} className="text-xs font-mono text-text-secondary flex gap-2">
                    <span className="text-text-tertiary">•</span>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preflight Checks */}
          <div>
            <h3 className="text-xs font-mono text-text-tertiary mb-2">{t('systemUpdate.preflight')}</h3>
            <PreflightCheck checks={preflightChecks} />
          </div>

          {/* Update button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={hasPreflightErrors}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-phosphor-amber text-void font-bold font-mono text-sm hover:bg-phosphor-amber-bright transition-colors shadow-glow-amber disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {t('systemUpdate.updateTo', { version: `v${latestVersion}` })}
            </button>
            {hasPreflightErrors && (
              <span className="flex items-center gap-1 text-xs text-phosphor-red font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('systemUpdate.stopProductionFirst')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Updating Terminal */}
      {(isUpdating || updateComplete) && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-text-tertiary">
            {isUpdating ? t('systemUpdate.updating') : (
              updateComplete === 'success' ? t('systemUpdate.updateSuccess') : t('systemUpdate.updateFailed')
            )}
          </h3>
          <UpdateTerminal logLines={logLines} isActive={isUpdating} />
        </div>
      )}

      {/* Update History */}
      <div className="bg-panel rounded-lg border border-surface-border p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">{t('systemUpdate.history')}</h3>
        <UpdateHistory history={history} />
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="bg-panel rounded-lg border border-surface-border p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-phosphor-amber shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-text-primary mb-1">Confirm Update</h3>
                <p className="text-sm text-text-secondary">
                  {t('systemUpdate.confirmUpdate', { version: `v${latestVersion}` })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={triggerUpdate}
                className="px-4 py-2 rounded-lg bg-phosphor-amber text-void font-medium text-sm hover:bg-phosphor-amber-bright transition-colors"
              >
                {t('systemUpdate.updateTo', { version: `v${latestVersion}` })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

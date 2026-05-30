'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useSystemUpdate } from '@/hooks/useSystemUpdate'
import { useI18n } from '@/hooks/useI18n'
import { useToast } from '@/hooks/useToast'

export default function VersionBadge() {
  const router = useRouter()
  const { isSuperAdmin } = useAuth()
  const { t } = useI18n()
  const { showToast } = useToast()
  const hasNotifiedRef = useRef(false)

  const {
    currentVersion,
    isUpdateAvailable,
    latestVersion,
    commitsBehind,
    loading,
  } = useSystemUpdate({ autoCheck: isSuperAdmin })

  // Show toast once when update is detected (superadmin only)
  useEffect(() => {
    if (isSuperAdmin && isUpdateAvailable && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true
      showToast(t('systemUpdate.toastUpdateAvailable', {
        version: `v${latestVersion}`,
        commits: commitsBehind,
      }))
    }
  }, [isSuperAdmin, isUpdateAvailable, latestVersion, commitsBehind, showToast, t])

  const handleClick = () => {
    if (isSuperAdmin) {
      router.push('/super-admin/system-update')
    }
  }

  const tooltip = isUpdateAvailable
    ? `Update available: v${latestVersion}`
    : 'System up to date'

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-terminal hover:bg-elevated transition-colors ${
        isSuperAdmin ? 'cursor-pointer' : 'cursor-default'
      }`}
      title={tooltip}
    >
      {/* Update available indicator */}
      {isUpdateAvailable && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-phosphor-amber opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-phosphor-amber" />
        </span>
      )}

      {/* Version text */}
      <span className="font-mono text-xs text-text-secondary hover:text-text-primary transition-colors">
        {loading ? '...' : currentVersion ? `v${currentVersion}` : '—'}
      </span>
    </button>
  )
}

'use client'

/**
 * HeaderInfoBar - Notification Bell + Last Sync for inspection pages
 * Shows notification bell for manager/engineer roles
 * Shows last sync time indicator
 * Full i18n support
 */

import { useState, useEffect, useRef } from 'react'
import { Bell, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { authFetch } from '@/lib/utils/authFetch'
import { cn } from '@/lib/utils'
import NotificationDrawer from '@/components/notifications/NotificationDrawer'

export function HeaderInfoBar({ className }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastSync, setLastSync] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState('checking') // 'synced', 'pending', 'error', 'checking'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const intervalRef = useRef(null)

  // Check if user should see notifications (manager, engineer, super_admin)
  const showNotifications = ['manager', 'engineer', 'super_admin'].includes(user?.role?.toLowerCase())

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    if (!user?.id || !showNotifications) return
    
    try {
      const response = await authFetch(`/api/notifications?user_id=${user.id}&read=false&limit=1`)
      const result = await response.json()
      if (result.success) {
        setUnreadCount(result.total || 0)
      }
    } catch (error) {
      console.warn('[HeaderInfoBar] Failed to fetch notifications:', error)
    }
  }

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await authFetch('/api/sync-queue/status')
      const result = await response.json()
      
      if (result.success) {
        const data = result.data || {}
        
        // Set last sync time
        if (data.lastSync) {
          setLastSync(new Date(data.lastSync))
        }
        
        // Set pending count
        const totalPending = data.pending?.total || 0
        setPendingCount(totalPending)
        
        // Determine sync status
        if (totalPending > 0) {
          setSyncStatus('pending')
        } else if (data.lastSync) {
          setSyncStatus('synced')
        } else {
          // No lastSync but also no pending - system is idle/ready
          setSyncStatus('synced')
        }
      }
    } catch (error) {
      console.warn('[HeaderInfoBar] Failed to fetch sync status:', error)
      setSyncStatus('error')
    }
  }

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount()
    fetchSyncStatus()
    
    // Poll every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchUnreadCount()
      fetchSyncStatus()
    }, 30000)
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user?.id, showNotifications])

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSync) {
      // No sync history yet - show "Ready" instead of "Never"
      return t('sync.ready')
    }
    
    const now = new Date()
    const diffMs = now - lastSync
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return t('time.justNow')
    if (diffMins < 60) return `${diffMins}${t('sync.mAgo')}`
    if (diffHours < 24) return `${diffHours}${t('sync.hAgo')}`
    
    return lastSync.toLocaleDateString('id-ID', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const displayCount = unreadCount > 9 ? '9+' : unreadCount

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Sync Status Indicator */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 border",
        syncStatus === 'synced' && "border-phosphor-green/50 bg-phosphor-green/5",
        syncStatus === 'pending' && "border-phosphor-amber/50 bg-phosphor-amber/5",
        syncStatus === 'error' && "border-phosphor-red/50 bg-phosphor-red/5",
        syncStatus === 'checking' && "border-surface-border bg-surface-border/10"
      )}>
        {syncStatus === 'synced' && <CheckCircle2 className="w-4 h-4 text-phosphor-green" />}
        {syncStatus === 'pending' && <RefreshCw className="w-4 h-4 text-phosphor-amber animate-spin" />}
        {syncStatus === 'error' && <CloudOff className="w-4 h-4 text-phosphor-red" />}
        {syncStatus === 'checking' && <Cloud className="w-4 h-4 text-text-tertiary animate-pulse" />}
        
        <div className="flex flex-col">
          <span className="font-mono text-xxs text-text-tertiary">
            {syncStatus === 'pending' ? t('header.syncPending') : t('header.sync')}
          </span>
          <span className={cn(
            "font-mono text-xs font-medium",
            syncStatus === 'synced' && "text-phosphor-green",
            syncStatus === 'pending' && "text-phosphor-amber",
            syncStatus === 'error' && "text-phosphor-red",
            syncStatus === 'checking' && "text-text-secondary"
          )}>
            {syncStatus === 'pending' ? `${pendingCount} ${t('sync.items')}` : formatLastSync()}
          </span>
        </div>
      </div>

      {/* Notification Bell - Only for Manager/Engineer/SuperAdmin */}
      {showNotifications && (
        <>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={cn(
              "relative p-2 border transition-all",
              unreadCount > 0
                ? "border-phosphor-amber bg-phosphor-amber/10 text-phosphor-amber hover:bg-phosphor-amber/20"
                : "border-surface-border bg-terminal text-text-tertiary hover:border-text-tertiary hover:text-text-secondary"
            )}
            title={`${unreadCount} ${t('header.notifications')}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-phosphor-red text-void text-xs font-bold rounded-full animate-pulse">
                {displayCount}
              </span>
            )}
          </button>

          <NotificationDrawer 
            isOpen={isDrawerOpen} 
            onClose={() => {
              setIsDrawerOpen(false)
              // Refresh count after closing
              setTimeout(fetchUnreadCount, 500)
            }} 
          />
        </>
      )}
    </div>
  )
}

export default HeaderInfoBar

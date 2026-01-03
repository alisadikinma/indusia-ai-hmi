'use client';

/**
 * NotificationContext
 * Real-time notifications from API - NO MOCK DATA
 */

import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { subscribeToNotifications } from '@/lib/realtime/subscriptions';

const NotificationContext = createContext(null);

export const NOTIFICATION_TYPES = {
  SYSTEM: 'SYSTEM',
  WORKFLOW: 'WORKFLOW',
};

export const NOTIFICATION_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

export function NotificationProvider({ children, userId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    type: null,
    severity: null,
    category: null,
    section: null,
    onlyUnread: false,
  });

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      params.append('limit', '50');
      
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');
      
      setNotifications(json.data || []);
    } catch (err) {
      console.error('[NotificationContext] Fetch error:', err.message);
      setNotifications([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToNotifications(userId, (newNotif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) {
          return prev;
        }
        return [newNotif, ...prev];
      });

      // Dispatch custom event for toast notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('indusia-notification', {
          detail: {
            title: newNotif.title,
            description: newNotif.message,
            variant: newNotif.severity === 'critical' ? 'error' :
                     newNotif.severity === 'warning' ? 'warning' : 'info'
          }
        }));
      }
    });

    return unsubscribe;
  }, [userId]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], read: true })
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');
    } catch (err) {
      console.error('[NotificationContext] Mark read error:', err.message);
    }

    // Update local state
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, markAllRead: true })
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');
    } catch (err) {
      console.error('[NotificationContext] Mark all read error:', err.message);
    }

    // Update local state
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true }))
    );
  }, [userId]);

  const addNotification = useCallback(async (payload) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId })
      });
      if (!res.ok) throw new Error('Failed to add notification');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');
      
      setNotifications((prev) => [json.data, ...prev]);
      return json.data;
    } catch (err) {
      console.error('[NotificationContext] Add error:', err.message);
      throw err;
    }
  }, [userId]);

  const updateFilterOptions = useCallback((partial) => {
    setFilterOptions((prev) => ({ ...prev, ...partial }));
  }, []);

  const refreshNotifications = fetchNotifications;

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    addNotification,
    filterOptions,
    setFilterOptions: updateFilterOptions,
    refreshNotifications,
    NOTIFICATION_TYPES,
    NOTIFICATION_SEVERITY,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

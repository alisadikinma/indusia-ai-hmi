'use client';

import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { mockNotifications } from '@/data/mockNotifications';

const NotificationContext = createContext(null);

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

  // Fetch notifications from API with fallback to mock data
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([...mockNotifications]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ user_id: userId });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setNotifications(json.data);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      setNotifications([...mockNotifications]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    } catch (err) {
      console.warn('API failed, using local update:', err.message);
    }

    // Always update local state
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (userId) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, markAllRead: true })
        });
        if (!res.ok) throw new Error('API request failed');
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } catch (err) {
        console.warn('API failed, using local update:', err.message);
      }
    }

    // Always update local state
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true }))
    );
  }, [userId]);

  const addNotification = useCallback(async (payload) => {
    const newNotification = {
      id: `ntf_${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
      userId: userId || null,
      relatedEventId: null,
      ...payload,
    };

    if (userId) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, userId })
        });
        if (!res.ok) throw new Error('API request failed');
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setNotifications((prev) => [json.data, ...prev]);
        return json.data;
      } catch (err) {
        console.warn('API failed, using local add:', err.message);
      }
    }

    // Fallback to local add
    setNotifications((prev) => [newNotification, ...prev]);
    return newNotification;
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

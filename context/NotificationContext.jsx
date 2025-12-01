'use client';

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { mockNotifications } from '@/data/mockNotifications';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filterOptions, setFilterOptions] = useState({
    type: null,
    severity: null,
    category: null,
    section: null,
    onlyUnread: false,
  });

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true }))
    );
  }, []);

  const addNotification = useCallback((payload) => {
    const newNotification = {
      id: `ntf_${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
      userId: null,
      relatedEventId: null,
      ...payload,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const updateFilterOptions = useCallback((partial) => {
    setFilterOptions((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    filterOptions,
    setFilterOptions: updateFilterOptions,
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

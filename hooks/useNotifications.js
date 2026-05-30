import { useMemo } from 'react';
import { useNotificationContext } from '@/context/NotificationContext';

export function useNotifications() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    filterOptions,
    setFilterOptions,
  } = useNotificationContext();

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filterOptions.type) {
      result = result.filter((n) => n.type === filterOptions.type);
    }

    if (filterOptions.severity) {
      result = result.filter((n) => n.severity === filterOptions.severity);
    }

    if (filterOptions.category) {
      result = result.filter((n) => n.category === filterOptions.category);
    }

    if (filterOptions.section) {
      result = result.filter((n) => n.section === filterOptions.section);
    }

    if (filterOptions.onlyUnread) {
      result = result.filter((n) => !n.read);
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return result;
  }, [notifications, filterOptions]);

  return {
    notifications,
    filteredNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    filterOptions,
    setFilterOptions,
  };
}

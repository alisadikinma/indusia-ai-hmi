'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationDrawer from './NotificationDrawer';

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const displayCount = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`relative p-2 rounded-lg transition-all ${
          unreadCount > 0
            ? 'text-indusia-primary hover:bg-indusia-primary/10'
            : 'text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg'
        }`}
        title={`${unreadCount} unread notifications`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-indusia-fail text-white text-xs font-bold rounded-full">
            {displayCount}
          </span>
        )}
      </button>

      <NotificationDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}

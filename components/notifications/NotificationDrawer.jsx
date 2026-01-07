'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useI18n } from '@/context/I18nContext';
import NotificationListItem from './NotificationListItem';
import NotificationFilters from './NotificationFilters';
import NotificationEmptyState from './NotificationEmptyState';

export default function NotificationDrawer({ isOpen, onClose }) {
  const router = useRouter();
  const { t } = useI18n();
  const {
    filteredNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    filterOptions,
    setFilterOptions,
  } = useNotifications();

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Handle override notifications - redirect to page with query param
    if (notification.category === 'OVERRIDE_SUBMITTED') {
      // Parse metadata if it's a string
      let metadata = notification.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.error('Failed to parse notification metadata:', e);
        }
      }
      
      const overrideId = metadata?.overrideId;
      if (overrideId) {
        // Close drawer and redirect to override page with query param
        onClose();
        router.push(`/inspection/overrides?review=${overrideId}`);
      }
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleViewEventLog = () => {
    router.push('/event-log');
    onClose();
  };

  const hasFilters =
    filterOptions.type ||
    filterOptions.severity ||
    filterOptions.category ||
    filterOptions.section ||
    filterOptions.onlyUnread;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-screen w-full max-w-md bg-indusia-surface border-l border-indusia-border shadow-2xl z-[70] flex flex-col">
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-indusia-text">{t('notifications.title')}</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-indusia-primary text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-1.5 text-xs font-medium text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg rounded-lg transition-colors flex items-center gap-1.5"
                title={t('notifications.markAllRead')}
              >
                <CheckCheck className="w-4 h-4" />
                {t('notifications.markAllRead')}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg rounded-lg transition-colors"
              title={t('buttons.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <NotificationFilters
          filterOptions={filterOptions}
          onFilterChange={setFilterOptions}
        />

        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <NotificationEmptyState hasFilters={hasFilters} />
          ) : (
            <div className="divide-y divide-indusia-border">
              {filteredNotifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-indusia-border bg-indusia-surfaceMuted">
          <button
            onClick={handleViewEventLog}
            className="w-full flex items-center justify-center gap-2 text-sm text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <span>{t('notifications.viewDetailedHistory')}</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

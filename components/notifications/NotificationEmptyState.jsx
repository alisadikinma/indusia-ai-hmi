'use client';

import { BellOff, CheckCircle } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

export default function NotificationEmptyState({ hasFilters = false }) {
  const { t } = useI18n();
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {hasFilters ? (
        <BellOff className="w-12 h-12 text-indusia-textMuted mb-4" />
      ) : (
        <CheckCircle className="w-12 h-12 text-indusia-pass mb-4" />
      )}
      <h3 className="text-sm font-semibold text-indusia-text mb-2">
        {hasFilters ? t('notifications.noNotificationsFound') : t('notifications.allCaughtUp')}
      </h3>
      <p className="text-xs text-indusia-textMuted max-w-xs">
        {hasFilters
          ? t('notifications.tryAdjustingFilters')
          : t('notifications.weWillLetYouKnow')}
      </p>
    </div>
  );
}

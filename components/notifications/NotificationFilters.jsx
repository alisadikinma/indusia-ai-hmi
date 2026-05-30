'use client';

import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITY } from '@/data/mockNotifications';
import { useI18n } from '@/context/I18nContext';

export default function NotificationFilters({ filterOptions, onFilterChange }) {
  const { t } = useI18n();
  
  return (
    <div className="px-4 py-3 bg-indusia-surfaceMuted border-y border-indusia-border space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-indusia-textMuted mb-1">
            {t('notifications.type')}
          </label>
          <select
            value={filterOptions.type || ''}
            onChange={(e) => onFilterChange({ type: e.target.value || null })}
            className="w-full px-3 py-1.5 bg-indusia-bg border border-indusia-border rounded-lg text-xs text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          >
            <option value="">{t('notifications.all')}</option>
            <option value={NOTIFICATION_TYPES.SYSTEM}>{t('notifications.system')}</option>
            <option value={NOTIFICATION_TYPES.WORKFLOW}>{t('notifications.workflow')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-indusia-textMuted mb-1">
            {t('notifications.severity')}
          </label>
          <select
            value={filterOptions.severity || ''}
            onChange={(e) => onFilterChange({ severity: e.target.value || null })}
            className="w-full px-3 py-1.5 bg-indusia-bg border border-indusia-border rounded-lg text-xs text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          >
            <option value="">{t('notifications.all')}</option>
            <option value={NOTIFICATION_SEVERITY.INFO}>{t('notifications.info')}</option>
            <option value={NOTIFICATION_SEVERITY.WARNING}>{t('notifications.warning')}</option>
            <option value={NOTIFICATION_SEVERITY.CRITICAL}>{t('notifications.critical')}</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filterOptions.onlyUnread}
          onChange={(e) => onFilterChange({ onlyUnread: e.target.checked })}
          className="w-4 h-4 text-indusia-primary bg-indusia-bg border-indusia-border rounded focus:ring-2 focus:ring-indusia-primary"
        />
        <span className="text-xs text-indusia-text">{t('notifications.showUnreadOnly')}</span>
      </label>
    </div>
  );
}

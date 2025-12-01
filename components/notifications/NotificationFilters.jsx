import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITY } from '@/data/mockNotifications';

export default function NotificationFilters({ filterOptions, onFilterChange }) {
  return (
    <div className="px-4 py-3 bg-indusia-surfaceMuted border-y border-indusia-border space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-indusia-textMuted mb-1">
            Type
          </label>
          <select
            value={filterOptions.type || ''}
            onChange={(e) => onFilterChange({ type: e.target.value || null })}
            className="w-full px-3 py-1.5 bg-indusia-bg border border-indusia-border rounded-lg text-xs text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          >
            <option value="">All</option>
            <option value={NOTIFICATION_TYPES.SYSTEM}>System</option>
            <option value={NOTIFICATION_TYPES.WORKFLOW}>Workflow</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-indusia-textMuted mb-1">
            Severity
          </label>
          <select
            value={filterOptions.severity || ''}
            onChange={(e) => onFilterChange({ severity: e.target.value || null })}
            className="w-full px-3 py-1.5 bg-indusia-bg border border-indusia-border rounded-lg text-xs text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          >
            <option value="">All</option>
            <option value={NOTIFICATION_SEVERITY.INFO}>Info</option>
            <option value={NOTIFICATION_SEVERITY.WARNING}>Warning</option>
            <option value={NOTIFICATION_SEVERITY.CRITICAL}>Critical</option>
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
        <span className="text-xs text-indusia-text">Show unread only</span>
      </label>
    </div>
  );
}

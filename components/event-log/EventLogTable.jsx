import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';

const EVENT_COLORS = {
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  OVERRIDE_SUBMIT: 'info',
  OVERRIDE_APPROVE: 'pass',
  OVERRIDE_REJECT: 'fail',
  MASTERDATA_CREATE: 'info',
  MASTERDATA_UPDATE: 'warning',
  MASTERDATA_DELETE: 'fail',
  SYNC_START: 'info',
  SYNC_SUCCESS: 'pass',
  SYNC_FAIL: 'fail',
};

const ROLE_COLORS = {
  operator: 'info',
  manager: 'warning',
  engineer: 'info',
  superadmin: 'fail',
};

export default function EventLogTable({
  events,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEventClick,
}) {
  const getEventDetails = (event) => {
    const details = event.details;
    switch (event.type) {
      case 'LOGIN':
      case 'LOGOUT':
        return `IP: ${details.ipAddress || 'N/A'}`;
      case 'OVERRIDE_SUBMIT':
        return `Board: ${details.boardId} | ${details.defectType}`;
      case 'OVERRIDE_APPROVE':
      case 'OVERRIDE_REJECT':
        return `Board: ${details.boardId} | ${details.decision}`;
      case 'MASTERDATA_CREATE':
      case 'MASTERDATA_UPDATE':
      case 'MASTERDATA_DELETE':
        return `${details.entityType}: ${details.entityId || 'N/A'}`;
      case 'SYNC_START':
      case 'SYNC_SUCCESS':
        return `Job: ${details.syncJobId} | Scope: ${details.scope}`;
      case 'SYNC_FAIL':
        return `Job: ${details.syncJobId} | ${details.error}`;
      default:
        return JSON.stringify(details).substring(0, 50);
    }
  };

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-indusia-surfaceMuted border-b border-indusia-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Section
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-indusia-textMuted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indusia-border">
            {events.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <p className="text-indusia-textMuted">No events found</p>
                </td>
              </tr>
            ) : (
              events.map((event, index) => (
                <tr
                  key={event.id}
                  className={`hover:bg-indusia-bg transition-colors cursor-pointer ${
                    index % 2 === 0 ? 'bg-indusia-surface' : 'bg-indusia-surfaceMuted/30'
                  }`}
                  onClick={() => onEventClick(event)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indusia-text">
                    {format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-indusia-text font-medium">
                        {event.userName}
                      </span>
                      <StatusBadge
                        status={event.role}
                        variant={ROLE_COLORS[event.role]}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indusia-textMuted">
                    {event.section || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge
                      status={event.type.replace(/_/g, ' ')}
                      variant={EVENT_COLORS[event.type]}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indusia-textMuted">
                    {event.source}
                  </td>
                  <td className="px-6 py-4 text-sm text-indusia-textMuted max-w-xs truncate">
                    {getEventDetails(event)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className="text-indusia-textMuted hover:text-indusia-text transition-colors"
                      title="View details"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-indusia-border flex items-center justify-between bg-indusia-surfaceMuted">
        <div className="flex items-center gap-3">
          <span className="text-sm text-indusia-textMuted">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-3 py-1.5 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-indusia-textMuted">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || totalPages === 0}
              className="p-2 rounded-lg text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

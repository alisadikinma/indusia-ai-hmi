'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEventLog } from '@/hooks/useEventLog';
import SectionHeader from '@/components/common/SectionHeader';
import EventLogSummaryCards from '@/components/event-log/EventLogSummaryCards';
import EventLogFilters from '@/components/event-log/EventLogFilters';
import EventLogTable from '@/components/event-log/EventLogTable';
import EventLogDetailDrawer from '@/components/event-log/EventLogDetailDrawer';

export default function EventLogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    events,
    paginatedEvents,
    filters,
    setFilters,
    resetFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    exportCsv,
    EVENT_TYPES,
    EVENT_SOURCES,
  } = useEventLog();

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!['manager', 'engineer', 'superadmin'].includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted mb-6">
            You do not have permission to access the Event Log.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Event Log / Audit Trail"
        subtitle="Track and review all system activities and user actions"
      />

      <EventLogSummaryCards events={events} />

      <EventLogFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={resetFilters}
        onExport={exportCsv}
        eventTypes={EVENT_TYPES}
        sources={EVENT_SOURCES}
        totalCount={totalCount}
      />

      <EventLogTable
        events={paginatedEvents}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onEventClick={handleEventClick}
      />

      <EventLogDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}

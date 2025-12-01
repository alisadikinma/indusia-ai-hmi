import { useState, useMemo, useCallback } from 'react';
import { mockEvents, EVENT_TYPES, EVENT_SOURCES } from '@/data/mockEvents';

export function useEventLog() {
  const [filters, setFilters] = useState({
    userId: null,
    role: null,
    section: null,
    eventTypes: [],
    source: null,
    from: null,
    to: null,
    search: '',
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredEvents = useMemo(() => {
    let result = [...mockEvents];

    if (filters.role) {
      result = result.filter((event) => event.role === filters.role);
    }

    if (filters.section) {
      result = result.filter((event) => event.section === filters.section);
    }

    if (filters.eventTypes.length > 0) {
      result = result.filter((event) => filters.eventTypes.includes(event.type));
    }

    if (filters.source) {
      result = result.filter((event) => event.source === filters.source);
    }

    if (filters.from) {
      const fromDate = new Date(filters.from);
      result = result.filter((event) => new Date(event.timestamp) >= fromDate);
    }

    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((event) => new Date(event.timestamp) <= toDate);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((event) => {
        const searchableText = [
          event.userName,
          event.type,
          event.source,
          JSON.stringify(event.details),
        ]
          .join(' ')
          .toLowerCase();
        return searchableText.includes(searchLower);
      });
    }

    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return result;
  }, [filters]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, page, pageSize]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      userId: null,
      role: null,
      section: null,
      eventTypes: [],
      source: null,
      from: null,
      to: null,
      search: '',
    });
    setPage(1);
  }, []);

  const exportCsv = useCallback(() => {
    const headers = [
      'Timestamp',
      'Event Type',
      'User Name',
      'Role',
      'Section',
      'Source',
      'Details',
    ];

    const rows = filteredEvents.map((event) => [
      event.timestamp,
      event.type,
      event.userName,
      event.role,
      event.section || '',
      event.source,
      JSON.stringify(event.details),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `event-log-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return filteredEvents.length;
  }, [filteredEvents]);

  const changePage = useCallback((newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const changePageSize = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  return {
    events: mockEvents,
    filteredEvents,
    paginatedEvents,
    filters,
    setFilters: updateFilters,
    resetFilters,
    page,
    setPage: changePage,
    pageSize,
    setPageSize: changePageSize,
    totalCount: filteredEvents.length,
    totalPages,
    exportCsv,
    EVENT_TYPES,
    EVENT_SOURCES,
  };
}

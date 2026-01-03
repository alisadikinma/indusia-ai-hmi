/**
 * useEventLog Hook
 * Fetches and manages event log data from API - NO MOCK DATA
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export const EVENT_TYPES = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  OVERRIDE_SUBMIT: 'OVERRIDE_SUBMIT',
  OVERRIDE_APPROVE: 'OVERRIDE_APPROVE',
  OVERRIDE_REJECT: 'OVERRIDE_REJECT',
  MASTERDATA_CREATE: 'MASTERDATA_CREATE',
  MASTERDATA_UPDATE: 'MASTERDATA_UPDATE',
  MASTERDATA_DELETE: 'MASTERDATA_DELETE',
  SYNC_START: 'SYNC_START',
  SYNC_SUCCESS: 'SYNC_SUCCESS',
  SYNC_FAIL: 'SYNC_FAIL',
  INSPECTION_PASS: 'INSPECTION_PASS',
  INSPECTION_FAIL: 'INSPECTION_FAIL',
  FALSE_CALL: 'FALSE_CALL',
};

export const EVENT_SOURCES = {
  HMI: 'HMI',
  ADMIN_CONSOLE: 'AdminConsole',
  SYNC_SERVICE: 'SyncService',
  SYSTEM: 'System',
};

export function useEventLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFiltersState] = useState({
    userId: null,
    role: null,
    section: null,
    eventTypes: [],
    source: null,
    from: null,
    to: null,
    search: '',
  });

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.source) params.append('source', filters.source);
      if (filters.userId) params.append('user_id', filters.userId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.eventTypes.length === 1) params.append('type', filters.eventTypes[0]);
      params.append('limit', '200'); // Get more events

      const res = await authFetch(`/api/event-log?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch event log');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch event log');
      
      setEvents(json.data || []);
    } catch (err) {
      console.error('[useEventLog] Fetch error:', err.message);
      setEvents([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.source, filters.userId, filters.from, filters.to, filters.eventTypes]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

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
      result = result.filter((event) => new Date(event.timestamp || event.createdAt) >= fromDate);
    }

    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((event) => new Date(event.timestamp || event.createdAt) <= toDate);
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

    result.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

    return result;
  }, [events, filters]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, page, pageSize]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);

  const updateFilters = useCallback((newFilters) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({
      userId: null,
      role: null,
      section: null,
      eventTypes: [],
      source: null,
      from: null,
      to: null,
      search: '',
    });
    setPageState(1);
  }, []);

  const logEvent = async (eventData) => {
    try {
      const res = await authFetch('/api/event-log', {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
      if (!res.ok) throw new Error('Failed to log event');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to log event');
      
      setEvents(prev => [json.data, ...prev]);
      return json.data;
    } catch (err) {
      console.error('[useEventLog] Log error:', err.message);
      throw err;
    }
  };

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
      event.timestamp || event.createdAt,
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
    setPageState(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  const changePageSize = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setPageState(1);
  }, []);

  const refreshEvents = fetchEvents;

  return {
    events,
    filteredEvents,
    paginatedEvents,
    loading,
    error,
    filters,
    setFilters: updateFilters,
    resetFilters,
    page,
    setPage: changePage,
    pageSize,
    setPageSize: changePageSize,
    totalCount: filteredEvents.length,
    totalPages,
    logEvent,
    exportCsv,
    refreshEvents,
    EVENT_TYPES,
    EVENT_SOURCES,
  };
}

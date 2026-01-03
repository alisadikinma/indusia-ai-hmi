/**
 * useOverrides Hook
 * Fetches and manages override data from API - NO MOCK DATA
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export function useOverrides(initialFilters = {}) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [filters, setFiltersState] = useState({
    status: null,
    sectionId: null,
    customerId: null,
    from: null,
    to: null,
    page: 1,
    limit: 20,
    ...initialFilters
  });

  // Fetch overrides from API
  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.sectionId) params.append('section_id', filters.sectionId);
      if (filters.customerId) params.append('customer_id', filters.customerId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await authFetch(`/api/overrides?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch overrides');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch overrides');
      
      setOverrides(json.data || []);
    } catch (err) {
      console.error('[useOverrides] Fetch error:', err.message);
      setOverrides([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/overrides/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch stats');
      
      setStats(json.data || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      console.error('[useOverrides] Stats error:', err.message);
      setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
    fetchStats();
  }, [fetchOverrides, fetchStats]);

  const setFilters = useCallback((newFilters) => {
    setFiltersState(prev => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({
      status: null,
      sectionId: null,
      customerId: null,
      from: null,
      to: null,
      page: 1,
      limit: 20,
    });
  }, []);

  const createOverride = async (data) => {
    try {
      const res = await authFetch('/api/overrides', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create override');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create override');
      
      setOverrides(prev => [json.data, ...prev]);
      await fetchStats();
      return json.data;
    } catch (err) {
      console.error('[useOverrides] Create error:', err.message);
      throw err;
    }
  };

  const approveOverride = async (id, reviewerId, reviewerName, notes = '') => {
    try {
      const res = await authFetch(`/api/overrides/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'approve',
          reviewerId,
          reviewerName,
          reviewNotes: notes
        })
      });
      if (!res.ok) throw new Error('Failed to approve override');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to approve override');
      
      setOverrides(prev => prev.map(o => o.id === id ? json.data : o));
      await fetchStats();
      return json.data;
    } catch (err) {
      console.error('[useOverrides] Approve error:', err.message);
      throw err;
    }
  };

  const rejectOverride = async (id, reviewerId, reviewerName, notes = '') => {
    try {
      const res = await authFetch(`/api/overrides/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reject',
          reviewerId,
          reviewerName,
          reviewNotes: notes
        })
      });
      if (!res.ok) throw new Error('Failed to reject override');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reject override');
      
      setOverrides(prev => prev.map(o => o.id === id ? json.data : o));
      await fetchStats();
      return json.data;
    } catch (err) {
      console.error('[useOverrides] Reject error:', err.message);
      throw err;
    }
  };

  const getById = (id) => overrides.find(o => o.id === id);

  const refreshOverrides = useCallback(async () => {
    await fetchOverrides();
    await fetchStats();
  }, [fetchOverrides, fetchStats]);

  return {
    overrides,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    stats,
    createOverride,
    approveOverride,
    rejectOverride,
    getById,
    refreshOverrides,
  };
}

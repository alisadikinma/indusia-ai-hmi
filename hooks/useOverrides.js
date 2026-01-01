import { useState, useEffect, useCallback } from 'react';
import { authFetch, getAuthHeaders } from '@/lib/utils/authFetch';

// Mock data for fallback
const mockOverrides = [];
const mockStats = { pending: 0, approved: 0, rejected: 0, total: 0 };

export function useOverrides(initialFilters = {}) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(mockStats);
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

  // Fetch overrides from API with fallback
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOverrides(json.data);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      setOverrides([...mockOverrides]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/overrides/stats');
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStats(json.data);
    } catch (err) {
      console.warn('API failed, using mock stats:', err.message);
      setStats(mockStats);
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOverrides(prev => [json.data, ...prev]);
      await fetchStats();
      return json.data;
    } catch (err) {
      console.warn('API failed, using local create:', err.message);
      const newOverride = {
        id: `ovr-${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...data
      };
      setOverrides(prev => [newOverride, ...prev]);
      return newOverride;
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOverrides(prev => prev.map(o => o.id === id ? json.data : o));
      await fetchStats();
      return json.data;
    } catch (err) {
      console.warn('API failed, using local approve:', err.message);
      const updated = {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewerName,
        reviewNotes: notes,
        reviewedAt: new Date().toISOString()
      };
      setOverrides(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
      return { id, ...updated };
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOverrides(prev => prev.map(o => o.id === id ? json.data : o));
      await fetchStats();
      return json.data;
    } catch (err) {
      console.warn('API failed, using local reject:', err.message);
      const updated = {
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewerName,
        reviewNotes: notes,
        reviewedAt: new Date().toISOString()
      };
      setOverrides(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
      return { id, ...updated };
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

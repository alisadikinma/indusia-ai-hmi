/**
 * useOverrides Hook
 * Fetches and manages override data from API with localStorage caching
 * 
 * Features:
 * - Instant load from cache on mount
 * - Auto-refresh every 15 minutes
 * - Background refresh when cache expires
 * - Stale indicator
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

const CACHE_KEY_OVERRIDES = 'indusia_overrides_cache';
const CACHE_KEY_STATS = 'indusia_override_stats_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Cache helpers
const getCache = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp, filters: cachedFilters } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    return { data, timestamp, isExpired: age > CACHE_TTL, filters: cachedFilters };
  } catch (e) {
    return null;
  }
};

const setCache = (key, data, filters = null) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ 
      data, 
      timestamp: Date.now(),
      filters 
    }));
  } catch (e) {
    console.warn('[useOverrides] Cache save failed:', e);
  }
};

export function useOverrides(initialFilters = {}) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFiltersState] = useState({
    status: null,
    sectionId: null,
    customerId: null,
    from: null,
    to: null,
    page: 1,
    limit: 100, // Increased to get all for client-side filtering
    ...initialFilters
  });

  const refreshIntervalRef = useRef(null);

  // Fetch overrides from API
  const fetchOverrides = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      // Only add server-side filters that reduce data
      if (filters.sectionId) params.append('section_id', filters.sectionId);
      if (filters.customerId) params.append('customer_id', filters.customerId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      params.append('limit', '100'); // Get more for client-side filtering

      const res = await authFetch(`/api/overrides?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch overrides');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch overrides');
      
      const data = json.data || [];
      setOverrides(data);
      setCache(CACHE_KEY_OVERRIDES, data, filters);
      setIsStale(false);
      setLastUpdated(new Date());
      
      return data;
    } catch (err) {
      console.error('[useOverrides] Fetch error:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters.sectionId, filters.customerId, filters.from, filters.to]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/overrides/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch stats');
      
      const data = json.data || { pending: 0, approved: 0, rejected: 0, total: 0 };
      setStats(data);
      setCache(CACHE_KEY_STATS, data);
      
      return data;
    } catch (err) {
      console.error('[useOverrides] Stats error:', err.message);
      // Don't throw, stats are optional
    }
  }, []);

  // Initial load - use cache if available
  useEffect(() => {
    const initLoad = async () => {
      // Try to load from cache first
      const cachedOverrides = getCache(CACHE_KEY_OVERRIDES);
      const cachedStats = getCache(CACHE_KEY_STATS);
      
      if (cachedOverrides?.data) {
        setOverrides(cachedOverrides.data);
        setLastUpdated(new Date(cachedOverrides.timestamp));
        setLoading(false);
        
        if (cachedOverrides.isExpired) {
          setIsStale(true);
          // Refresh in background
          fetchOverrides(false).catch(() => {});
        }
      } else {
        // No cache, fetch fresh
        await fetchOverrides(true).catch(() => {});
      }
      
      if (cachedStats?.data) {
        setStats(cachedStats.data);
        if (cachedStats.isExpired) {
          fetchStats().catch(() => {});
        }
      } else {
        await fetchStats().catch(() => {});
      }
    };

    initLoad();
  }, []); // Only run once on mount

  // Auto-refresh interval
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      const cached = getCache(CACHE_KEY_OVERRIDES);
      if (!cached || cached.isExpired) {
        console.log('[useOverrides] Auto-refreshing (cache expired)');
        fetchOverrides(false).catch(() => {});
        fetchStats().catch(() => {});
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
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
      limit: 100,
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
      
      // Update local state and cache
      setOverrides(prev => {
        const updated = [json.data, ...prev];
        setCache(CACHE_KEY_OVERRIDES, updated, filters);
        return updated;
      });
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
      
      // Update local state and cache
      setOverrides(prev => {
        const updated = prev.map(o => o.id === id ? json.data : o);
        setCache(CACHE_KEY_OVERRIDES, updated, filters);
        return updated;
      });
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
      
      // Update local state and cache
      setOverrides(prev => {
        const updated = prev.map(o => o.id === id ? json.data : o);
        setCache(CACHE_KEY_OVERRIDES, updated, filters);
        return updated;
      });
      await fetchStats();
      return json.data;
    } catch (err) {
      console.error('[useOverrides] Reject error:', err.message);
      throw err;
    }
  };

  const getById = (id) => overrides.find(o => o.id === id);

  const refreshOverrides = useCallback(async () => {
    await fetchOverrides(true);
    await fetchStats();
  }, [fetchOverrides, fetchStats]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY_OVERRIDES);
    localStorage.removeItem(CACHE_KEY_STATS);
  }, []);

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
    // New cache-related
    isStale,
    lastUpdated,
    clearCache,
  };
}

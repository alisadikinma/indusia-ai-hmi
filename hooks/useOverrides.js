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
const CACHE_TTL = 30 * 1000; // 30 seconds — overrides are created from LiveView, cache goes stale fast
const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds — manager approval queue needs near-real-time updates

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

/**
 * Clear override caches so subsequent reads fetch fresh data.
 * Call this after creating/modifying overrides from outside the hook.
 */
export function clearOverridesCache() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CACHE_KEY_OVERRIDES)
    localStorage.removeItem(CACHE_KEY_STATS)
  } catch (e) { /* localStorage may be unavailable */ }
}

export function useOverrides(initialFilters = {}) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, reviewed: 0, total: 0 });
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
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[useOverrides] Non-OK response:', res.status, text.substring(0, 200));
        throw new Error(`Failed to fetch overrides (HTTP ${res.status})`);
      }

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
      if (showLoading) setLoading(false);
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

  // Initial load - use cache if available, retry on failure
  const hasInitializedRef = useRef(false);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initLoad = async () => {
      // Try to load from cache first
      const cachedOverrides = getCache(CACHE_KEY_OVERRIDES);
      const cachedStats = getCache(CACHE_KEY_STATS);

      if (cachedStats?.data) {
        setStats(cachedStats.data);
      }

      if (cachedOverrides?.data) {
        setOverrides(cachedOverrides.data);
        setLastUpdated(new Date(cachedOverrides.timestamp));
        setLoading(false);

        // Always refresh in background on mount — overrides may be created
        // from LiveView (bypasses useOverrides), so cache is often stale.
        // Show cached data instantly for fast UI, fetch fresh data silently.
        if (cachedOverrides.isExpired) {
          setIsStale(true);
        }
        Promise.all([
          fetchOverrides(false).catch(() => {}),
          fetchStats().catch(() => {})
        ]);
        return;
      }

      // No cache — ensure auth is ready, then fetch with retries
      // Wait briefly for auth to be stored in localStorage (race with AuthContext)
      if (typeof window !== 'undefined' && !localStorage.getItem('indusia_user_id')) {
        console.log('[useOverrides] No user ID yet, waiting for auth...');
        await new Promise(r => setTimeout(r, 500));
      }

      // Keep loading=true across all retries so UI shows spinner, not "No overrides"
      setLoading(true);
      let fetched = false;
      for (let attempt = 0; attempt < 5 && !fetched; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`[useOverrides] Retry attempt ${attempt + 1}/5 in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
        try {
          await fetchOverrides(false);
          fetched = true;
        } catch (err) {
          console.warn(`[useOverrides] Attempt ${attempt + 1}/5 failed:`, err.message);
        }
      }
      setLoading(false);

      // Fetch stats (parallel-safe, non-blocking)
      if (!cachedStats?.data || cachedStats?.isExpired) {
        fetchStats().catch(() => {});
      }
    };

    initLoad();

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchOverrides, fetchStats]);

  // Recovery: if loading finished but overrides empty while stats show data exists,
  // retry once after a short delay (catches race conditions with auth)
  const recoveryAttemptedRef = useRef(false);
  useEffect(() => {
    if (loading || !hasInitializedRef.current || recoveryAttemptedRef.current) return;
    if (overrides.length === 0 && stats.total > 0) {
      recoveryAttemptedRef.current = true;
      console.log('[useOverrides] Recovery: empty list but stats.total =', stats.total, '— retrying');
      retryTimerRef.current = setTimeout(() => {
        fetchOverrides(true).catch(() => {});
      }, 1500);
    }
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [loading, overrides.length, stats.total, fetchOverrides]);

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

  const reviewOverride = async (id, reviewerId, reviewerName, frameDecisions, notes = '') => {
    try {
      const res = await authFetch(`/api/overrides/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'review',
          reviewerId,
          reviewerName,
          frameDecisions,
          reviewNotes: notes
        })
      });
      if (!res.ok) throw new Error('Failed to review override');

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to review override');

      // Update local state and cache
      setOverrides(prev => {
        const updated = prev.map(o => o.id === id ? json.data : o);
        setCache(CACHE_KEY_OVERRIDES, updated, filters);
        return updated;
      });
      await fetchStats();
      return json.data;
    } catch (err) {
      console.error('[useOverrides] Review error:', err.message);
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
    reviewOverride,
    getById,
    refreshOverrides,
    // New cache-related
    isStale,
    lastUpdated,
    clearCache,
  };
}

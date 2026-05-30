/**
 * useLocalStorageCache Hook
 * 
 * Caches API data in localStorage with TTL (time-to-live).
 * Provides instant loading from cache while refreshing in background.
 * 
 * @param {string} key - localStorage key
 * @param {Function} fetchFn - Async function to fetch fresh data
 * @param {Object} options - { ttl: ms (default 15min), refreshInterval: ms (optional) }
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

export function useLocalStorageCache(key, fetchFn, options = {}) {
  const { ttl = DEFAULT_TTL, refreshInterval = null, enabled = true } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);
  
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  // Get cached data from localStorage
  const getCached = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      return {
        data,
        timestamp,
        isExpired: age > ttl
      };
    } catch (e) {
      console.warn(`[Cache] Failed to parse cache for ${key}:`, e);
      return null;
    }
  }, [key, ttl]);

  // Save data to localStorage
  const setCache = useCallback((data) => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
      setLastUpdated(new Date());
      setIsStale(false);
    } catch (e) {
      console.warn(`[Cache] Failed to save cache for ${key}:`, e);
    }
  }, [key]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    setData(null);
    setLastUpdated(null);
  }, [key]);

  // Fetch fresh data
  const refresh = useCallback(async (showLoading = false) => {
    if (!enabled) return;
    
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const freshData = await fetchRef.current();
      setData(freshData);
      setCache(freshData);
      return freshData;
    } catch (err) {
      console.error(`[Cache] Fetch error for ${key}:`, err);
      setError(err.message || 'Failed to fetch data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, enabled, setCache]);

  // Initial load - use cache if available, fetch in background if stale
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cached = getCached();
    
    if (cached?.data) {
      // Use cached data immediately
      setData(cached.data);
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
      
      // If expired, mark as stale and refresh in background
      if (cached.isExpired) {
        setIsStale(true);
        refresh(false).catch(() => {
          // Keep stale data on error
        });
      }
    } else {
      // No cache, fetch fresh
      refresh(true).catch(() => {
        setLoading(false);
      });
    }
  }, [enabled, getCached, refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || !refreshInterval) return;

    const interval = setInterval(() => {
      const cached = getCached();
      if (!cached || cached.isExpired) {
        refresh(false).catch(() => {});
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enabled, refreshInterval, getCached, refresh]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    isStale,
    refresh: () => refresh(true),
    refreshSilent: () => refresh(false),
    clearCache
  };
}

/**
 * Hook for Override Approval Queue with caching
 */
export function useCachedOverrides(filters = {}) {
  const cacheKey = `indusia_overrides_${JSON.stringify(filters)}`;
  
  const fetchOverrides = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const res = await fetch(`/api/overrides?${params}`);
    const json = await res.json();
    
    if (!json.success) throw new Error(json.error);
    return {
      data: json.data,
      total: json.total
    };
  }, [filters]);

  return useLocalStorageCache(cacheKey, fetchOverrides, {
    ttl: 15 * 60 * 1000, // 15 minutes
    refreshInterval: 15 * 60 * 1000 // Auto-refresh every 15 minutes
  });
}

/**
 * Hook for Sync Queue History with caching
 */
export function useCachedSyncHistory(filters = {}) {
  const cacheKey = `indusia_sync_history_${JSON.stringify(filters)}`;
  
  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit || 50);
    
    const res = await fetch(`/api/sync-queue/history?${params}`);
    const json = await res.json();
    
    if (!json.success) throw new Error(json.error);
    return {
      data: json.data,
      stats: json.stats
    };
  }, [filters]);

  return useLocalStorageCache(cacheKey, fetchHistory, {
    ttl: 15 * 60 * 1000,
    refreshInterval: 15 * 60 * 1000
  });
}

/**
 * Hook for Override Stats with caching
 */
export function useCachedOverrideStats() {
  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/overrides/stats');
    const json = await res.json();
    
    if (!json.success) throw new Error(json.error);
    return json.data;
  }, []);

  return useLocalStorageCache('indusia_override_stats', fetchStats, {
    ttl: 5 * 60 * 1000, // 5 minutes for stats
    refreshInterval: 5 * 60 * 1000
  });
}

export default useLocalStorageCache;

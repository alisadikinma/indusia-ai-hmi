/**
 * useWorkOrders Hook
 * Custom hook for Work Order data management
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

/**
 * Fetch work orders with filters
 * @param {Object} filters - Query filters
 * @returns {Object} Hook state and methods
 */
export function useWorkOrders(initialFilters = {}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState(initialFilters);

  const fetchWorkOrders = useCallback(async (customFilters = null) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const activeFilters = customFilters || filters;

      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value);
          }
        }
      });

      const response = await authFetch(`/api/work-orders?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch work orders');
      }

      setWorkOrders(result.data || []);
      setCount(result.count || 0);
    } catch (err) {
      console.error('[useWorkOrders] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const refresh = useCallback(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    workOrders,
    loading,
    error,
    count,
    filters,
    setFilters: updateFilters,
    refresh,
  };
}

/**
 * Fetch single work order by ID
 * @param {string} id - Work order ID
 * @returns {Object} Hook state
 */
export function useWorkOrder(id) {
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkOrder = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch work order');
      }

      setWorkOrder(result.data);
    } catch (err) {
      console.error('[useWorkOrder] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorkOrder();
  }, [fetchWorkOrder]);

  return {
    workOrder,
    loading,
    error,
    refresh: fetchWorkOrder,
  };
}

/**
 * Fetch active work order for a line
 * @param {string} lineId - Line ID
 * @returns {Object} Hook state
 */
export function useActiveWorkOrder(lineId) {
  const [workOrder, setWorkOrder] = useState(null);
  const [lastCompleted, setLastCompleted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasActiveWO, setHasActiveWO] = useState(false);

  const fetchActiveWO = useCallback(async () => {
    if (!lineId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/active/${lineId}`);
      const result = await response.json();

      if (!response.ok) {
        // Handle 401 gracefully - user not logged in
        if (response.status === 401) {
          console.warn('[useActiveWorkOrder] Unauthorized - user may not be logged in');
          setHasActiveWO(false);
          setWorkOrder(null);
          return;
        }
        throw new Error(result.error || 'Failed to fetch active work order');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch active work order');
      }

      setWorkOrder(result.data);
      setHasActiveWO(result.hasActiveWO);
      setLastCompleted(result.lastCompleted || null);
    } catch (err) {
      console.error('[useActiveWorkOrder] Fetch error:', err);
      setError(err.message);
      setHasActiveWO(false);
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    fetchActiveWO();
  }, [fetchActiveWO]);

  return {
    workOrder,
    hasActiveWO,
    lastCompleted,
    loading,
    error,
    refresh: fetchActiveWO,
  };
}

/**
 * Work order mutations
 * @returns {Object} Mutation methods
 */
export function useWorkOrderMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.errors?.[0]?.message || 'Failed to create work order');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('[useWorkOrderMutations] Create error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update work order');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('[useWorkOrderMutations] Update error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete work order');
      }

      return { success: true };
    } catch (err) {
      console.error('[useWorkOrderMutations] Delete error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const start = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}/start`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start work order');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('[useWorkOrderMutations] Start error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const complete = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}/complete`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete work order');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('[useWorkOrderMutations] Complete error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCounters = useCallback(async (id, counters) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/work-orders/${id}/counters`, {
        method: 'PUT',
        body: JSON.stringify(counters),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update counters');
      }

      return { success: true, data: result.data, autoCompleted: result.autoCompleted };
    } catch (err) {
      console.error('[useWorkOrderMutations] UpdateCounters error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    create,
    update,
    remove,
    start,
    complete,
    updateCounters,
  };
}

export default {
  useWorkOrders,
  useWorkOrder,
  useActiveWorkOrder,
  useWorkOrderMutations,
};

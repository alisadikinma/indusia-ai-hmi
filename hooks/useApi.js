/**
 * useApi Hook
 * Provides authenticated API request function with CSRF protection
 * 
 * Usage:
 * const { api, isLoading, error } = useApi()
 * const result = await api('/api/users', { method: 'POST', body: JSON.stringify(data) })
 */

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export function useApi() {
  const { apiRequest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const api = useCallback(async (url, options = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest(url, options);
      const json = await response.json();

      if (!response.ok || !json.success) {
        const errorMessage = json.error || `HTTP ${response.status}`;
        setError(errorMessage);
        return { success: false, error: errorMessage, status: response.status };
      }

      return { success: true, data: json.data, ...json };
    } catch (err) {
      const errorMessage = err.message || 'Network error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [apiRequest]);

  // Convenience methods
  const get = useCallback((url, options = {}) => 
    api(url, { ...options, method: 'GET' }), [api]);

  const post = useCallback((url, data, options = {}) => 
    api(url, { ...options, method: 'POST', body: JSON.stringify(data) }), [api]);

  const put = useCallback((url, data, options = {}) => 
    api(url, { ...options, method: 'PUT', body: JSON.stringify(data) }), [api]);

  const patch = useCallback((url, data, options = {}) => 
    api(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }), [api]);

  const del = useCallback((url, options = {}) => 
    api(url, { ...options, method: 'DELETE' }), [api]);

  return {
    api,
    get,
    post,
    put,
    patch,
    delete: del,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}

export default useApi;

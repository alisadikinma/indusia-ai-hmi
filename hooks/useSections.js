/**
 * useSections Hook
 * Fetches sections from database API
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export function useSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/master-data/sections');
      if (!res.ok) throw new Error('Failed to fetch sections');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch sections');
      
      setSections(json.data || []);
    } catch (err) {
      console.error('[useSections] Fetch error:', err.message);
      setSections([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return {
    sections,
    loading,
    error,
    refetch: fetchSections
  };
}

export default useSections;

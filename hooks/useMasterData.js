/**
 * useMasterData Hook
 * Fetches master data from API - NO MOCK DATA
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export function useMasterData() {
  const [customers, setCustomers] = useState([]);
  const [sections, setSections] = useState([]);
  const [lines, setLines] = useState([]);
  const [boards, setBoards] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all master data from API
  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetchEndpoint = async (endpoint, setter) => {
      try {
        const res = await authFetch(endpoint);
        if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || `Failed to fetch ${endpoint}`);
        setter(json.data || []);
      } catch (err) {
        console.error(`[useMasterData] ${endpoint} error:`, err.message);
        setter([]);
        throw err;
      }
    };

    try {
      await Promise.all([
        fetchEndpoint('/api/master-data/customers', setCustomers),
        fetchEndpoint('/api/master-data/sections', setSections),
        fetchEndpoint('/api/master-data/lines', setLines),
        fetchEndpoint('/api/master-data/boards', setBoards),
        fetchEndpoint('/api/master-data/menu-items', setMenuItems),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Helper functions
  const getLinesBySection = useCallback((sectionId) => {
    return lines.filter(line => line.sectionId === sectionId);
  }, [lines]);

  const getLinesByCustomer = useCallback((customerId) => {
    return lines.filter(line => line.customerId === customerId);
  }, [lines]);

  const getBoardsByCustomer = useCallback((customerId) => {
    return boards.filter(board => board.customerId === customerId);
  }, [boards]);

  const getSectionsByCustomer = useCallback(async (customerId) => {
    try {
      const res = await authFetch(`/api/master-data/sections?customer_id=${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch sections');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch sections');
      return json.data || [];
    } catch (err) {
      console.error('[useMasterData] getSectionsByCustomer error:', err.message);
      return [];
    }
  }, []);

  const getCustomerById = useCallback((id) => {
    return customers.find(c => c.id === id);
  }, [customers]);

  const getSectionById = useCallback((id) => {
    return sections.find(s => s.id === id);
  }, [sections]);

  const getLineById = useCallback((id) => {
    return lines.find(l => l.id === id);
  }, [lines]);

  const getBoardById = useCallback((id) => {
    return boards.find(b => b.id === id);
  }, [boards]);

  const getMenuItemById = useCallback((id) => {
    return menuItems.find(m => m.id === id);
  }, [menuItems]);

  const refreshMasterData = fetchMasterData;

  return {
    customers,
    sections,
    lines,
    boards,
    menuItems,
    loading,
    error,
    getLinesBySection,
    getLinesByCustomer,
    getBoardsByCustomer,
    getSectionsByCustomer,
    getCustomerById,
    getSectionById,
    getLineById,
    getBoardById,
    getMenuItemById,
    refreshMasterData,
  };
}

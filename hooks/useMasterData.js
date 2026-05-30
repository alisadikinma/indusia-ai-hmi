/**
 * useMasterData Hook
 * Fetches master data from batch API - single request instead of 5
 *
 * Uses a window event ('masterdata-updated') so all hook instances
 * across different pages/components refetch when any instance mutates data.
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

const MASTER_DATA_UPDATED_EVENT = 'masterdata-updated';

/** Notify all useMasterData instances to refetch */
export function notifyMasterDataUpdated() {
  window.dispatchEvent(new Event(MASTER_DATA_UPDATED_EVENT));
}

export function useMasterData() {
  const [customers, setCustomers] = useState([]);
  const [sections, setSections] = useState([]);
  const [lines, setLines] = useState([]);
  const [boards, setBoards] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all master data from batch API (single request)
  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/master-data/batch');
      if (!res.ok) throw new Error('Failed to fetch master data');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch master data');

      const data = json.data || {};
      setCustomers(data.customers || []);
      setSections(data.sections || []);
      setLines(data.lines || []);
      setBoards(data.boards || []);
      setMenuItems(data.menuItems || []);
    } catch (err) {
      console.error('[useMasterData] batch fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Listen for cross-instance refresh signals
  useEffect(() => {
    window.addEventListener(MASTER_DATA_UPDATED_EVENT, fetchMasterData);
    return () => window.removeEventListener(MASTER_DATA_UPDATED_EVENT, fetchMasterData);
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

  const getSectionsByCustomer = useCallback((customerId) => {
    return sections.filter(s => s.customerId === customerId);
  }, [sections]);

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

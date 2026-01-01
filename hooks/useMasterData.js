import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';
import {
  customers as mockCustomers,
  sections as mockSections,
  lines as mockLines,
  boards as mockBoards,
  menuItems as mockMenuItems
} from '@/data/masterData';

export function useMasterData() {
  const [customers, setCustomers] = useState([]);
  const [sections, setSections] = useState([]);
  const [lines, setLines] = useState([]);
  const [boards, setBoards] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all master data from API with fallback
  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetchWithFallback = async (endpoint, fallbackData, setter) => {
      try {
        const res = await authFetch(endpoint);
        if (!res.ok) throw new Error('API request failed');
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setter(json.data);
      } catch (err) {
        console.warn(`${endpoint} API failed, using mock data:`, err.message);
        setter([...fallbackData]);
      }
    };

    try {
      await Promise.all([
        fetchWithFallback('/api/master-data/customers', mockCustomers, setCustomers),
        fetchWithFallback('/api/master-data/sections', mockSections, setSections),
        fetchWithFallback('/api/master-data/lines', mockLines, setLines),
        fetchWithFallback('/api/master-data/boards', mockBoards, setBoards),
        fetchWithFallback('/api/master-data/menu-items', mockMenuItems, setMenuItems),
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    } catch (err) {
      console.warn('API failed, filtering local data:', err.message);
      // Fall back to returning all sections (mock data doesn't have customer relation)
      return sections;
    }
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

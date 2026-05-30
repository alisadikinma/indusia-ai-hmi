/**
 * useRoles Hook
 * Fetches and manages roles from API - NO MOCK DATA
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export function useRoles() {
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch roles from API
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/roles');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch roles');
      setRolesList(json.data || []);
    } catch (err) {
      console.error('[useRoles] Fetch error:', err.message);
      setRolesList([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const list = () => rolesList;

  const getById = (id) => rolesList.find(r => r.id === id);

  const create = async (roleData) => {
    try {
      const res = await authFetch('/api/roles', {
        method: 'POST',
        body: JSON.stringify(roleData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create role');
      setRolesList(prev => [...prev, json.data]);
      return json.data;
    } catch (err) {
      console.error('[useRoles] Create error:', err.message);
      throw err;
    }
  };

  const update = async (id, updates) => {
    try {
      const res = await authFetch(`/api/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update role');
      setRolesList(prev => prev.map(r => r.id === id ? json.data : r));
      return json.data;
    } catch (err) {
      console.error('[useRoles] Update error:', err.message);
      throw err;
    }
  };

  const remove = async (id) => {
    const role = getById(id);
    if (role && role.isSystem) {
      throw new Error('Cannot delete system roles');
    }
    try {
      const res = await authFetch(`/api/roles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete role');
      setRolesList(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err) {
      console.error('[useRoles] Delete error:', err.message);
      throw err;
    }
  };

  const refreshRoles = fetchRoles;

  return {
    roles: rolesList,
    loading,
    error,
    list,
    getById,
    create,
    update,
    remove,
    refreshRoles,
  };
}

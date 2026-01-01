import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';
import { roles as mockRoles } from '@/data/masterData';

export function useRoles() {
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch roles from API with fallback to mock data
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/roles');
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRolesList(json.data);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      setRolesList([...mockRoles]);
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRolesList(prev => [...prev, json.data]);
      return json.data;
    } catch (err) {
      console.warn('API failed, using local create:', err.message);
      const newRole = {
        id: roleData.id || `role-${Date.now()}`,
        ...roleData,
        isSystem: false,
      };
      setRolesList(prev => [...prev, newRole]);
      return newRole;
    }
  };

  const update = async (id, updates) => {
    try {
      const res = await authFetch(`/api/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRolesList(prev => prev.map(r => r.id === id ? json.data : r));
      return json.data;
    } catch (err) {
      console.warn('API failed, using local update:', err.message);
      setRolesList(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return { ...getById(id), ...updates };
    }
  };

  const remove = async (id) => {
    const role = getById(id);
    if (role && role.isSystem) {
      throw new Error('Cannot delete system roles');
    }
    try {
      const res = await authFetch(`/api/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRolesList(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err) {
      console.warn('API failed, using local remove:', err.message);
      setRolesList(prev => prev.filter(r => r.id !== id));
      return true;
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

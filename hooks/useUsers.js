/**
 * useUsers Hook
 * Fetches and manages users from API - NO MOCK DATA
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/utils/authFetch';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch users');
      setUsers(json.data || []);
    } catch (err) {
      console.error('[useUsers] Fetch error:', err.message);
      setUsers([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const list = () => users;

  const getById = (id) => users.find(u => u.id === id);

  const create = async (userData) => {
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      if (!res.ok) throw new Error('Failed to create user');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create user');
      setUsers(prev => [...prev, json.data]);
      return json.data;
    } catch (err) {
      console.error('[useUsers] Create error:', err.message);
      throw err;
    }
  };

  const update = async (id, updates) => {
    try {
      const res = await authFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update user');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update user');
      setUsers(prev => prev.map(u => u.id === id ? json.data : u));
      return json.data;
    } catch (err) {
      console.error('[useUsers] Update error:', err.message);
      throw err;
    }
  };

  const remove = async (id) => {
    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete user');
      setUsers(prev => prev.filter(u => u.id !== id));
      return true;
    } catch (err) {
      console.error('[useUsers] Delete error:', err.message);
      throw err;
    }
  };

  const disable = async (id) => {
    return update(id, { status: 'disabled' });
  };

  const enable = async (id) => {
    return update(id, { status: 'active' });
  };

  const resetPassword = async (id) => {
    try {
      const res = await authFetch(`/api/users/${id}/reset-password`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to reset password');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reset password');
      
      // Refresh user to get mustChangePassword status
      await fetchUsers();
      return json.data?.tempPassword || 'Password reset. Check email.';
    } catch (err) {
      console.error('[useUsers] Reset password error:', err.message);
      throw err;
    }
  };

  const refreshUsers = fetchUsers;

  return {
    users,
    loading,
    error,
    list,
    getById,
    create,
    update,
    remove,
    disable,
    enable,
    resetPassword,
    refreshUsers,
  };
}

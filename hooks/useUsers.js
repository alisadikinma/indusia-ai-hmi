import { useState, useEffect, useCallback } from 'react';
import { userProfiles } from '@/data/masterData';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users from API with fallback to mock data
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUsers(json.data);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      setUsers([...userProfiles]);
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUsers(prev => [...prev, json.data]);
      return json.data;
    } catch (err) {
      console.warn('API failed, using local create:', err.message);
      const newUser = {
        id: `user-${Date.now()}`,
        ...userData,
        createdAt: new Date().toISOString(),
        status: 'active',
        mustChangePassword: false,
      };
      setUsers(prev => [...prev, newUser]);
      return newUser;
    }
  };

  const update = async (id, updates) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUsers(prev => prev.map(u => u.id === id ? json.data : u));
      return json.data;
    } catch (err) {
      console.warn('API failed, using local update:', err.message);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      return { ...getById(id), ...updates };
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUsers(prev => prev.filter(u => u.id !== id));
      return true;
    } catch (err) {
      console.warn('API failed, using local remove:', err.message);
      setUsers(prev => prev.filter(u => u.id !== id));
      return true;
    }
  };

  const disable = async (id) => {
    return update(id, { status: 'disabled' });
  };

  const enable = async (id) => {
    return update(id, { status: 'active' });
  };

  const resetPassword = async (id) => {
    const tempPassword = `Temp${Math.random().toString(36).substring(2, 8)}@123`;
    await update(id, {
      password: tempPassword,
      mustChangePassword: true,
    });
    return tempPassword;
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

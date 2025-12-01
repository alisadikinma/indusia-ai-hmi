import { useState, useEffect } from 'react';
import { userProfiles } from '@/data/masterData';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUsers([...userProfiles]);
    setLoading(false);
  }, []);

  const list = () => users;

  const getById = (id) => users.find(u => u.id === id);

  const create = (userData) => {
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData,
      createdAt: new Date().toISOString(),
      status: 'active',
      mustChangePassword: false,
    };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const update = (id, updates) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    return getById(id);
  };

  const remove = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const disable = (id) => {
    update(id, { status: 'disabled' });
  };

  const enable = (id) => {
    update(id, { status: 'active' });
  };

  const resetPassword = (id) => {
    const tempPassword = `Temp${Math.random().toString(36).substring(2, 8)}@123`;
    update(id, {
      password: tempPassword,
      mustChangePassword: true,
    });
    return tempPassword;
  };

  return {
    users,
    loading,
    list,
    getById,
    create,
    update,
    remove,
    disable,
    enable,
    resetPassword,
  };
}

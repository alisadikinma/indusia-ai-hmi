import { useState, useEffect } from 'react';
import { roles } from '@/data/masterData';

export function useRoles() {
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRolesList([...roles]);
    setLoading(false);
  }, []);

  const list = () => rolesList;

  const getById = (id) => rolesList.find(r => r.id === id);

  const create = (roleData) => {
    const newRole = {
      id: `role-${Date.now()}`,
      ...roleData,
      isSystem: false,
    };
    setRolesList(prev => [...prev, newRole]);
    return newRole;
  };

  const update = (id, updates) => {
    setRolesList(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    return getById(id);
  };

  const remove = (id) => {
    const role = getById(id);
    if (role && role.isSystem) {
      throw new Error('Cannot delete system roles');
    }
    setRolesList(prev => prev.filter(r => r.id !== id));
  };

  return {
    roles: rolesList,
    loading,
    list,
    getById,
    create,
    update,
    remove,
  };
}

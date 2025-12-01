import { useState, useEffect } from 'react';
import { permissions as defaultPermissions, menuItems } from '@/data/masterData';

export function usePermissions() {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPermissions({ ...defaultPermissions });
    setLoading(false);
  }, []);

  const getMenuItems = () => menuItems;

  const getRolePermissions = (roleId) => permissions[roleId] || [];

  const hasPermission = (roleId, menuId) => {
    const rolePerms = getRolePermissions(roleId);
    return rolePerms.includes(menuId);
  };

  const togglePermission = (roleId, menuId) => {
    setPermissions(prev => {
      const rolePerms = prev[roleId] || [];
      const hasIt = rolePerms.includes(menuId);

      return {
        ...prev,
        [roleId]: hasIt
          ? rolePerms.filter(id => id !== menuId)
          : [...rolePerms, menuId]
      };
    });
  };

  const setRolePermissions = (roleId, menuIds) => {
    setPermissions(prev => ({
      ...prev,
      [roleId]: menuIds,
    }));
  };

  return {
    permissions,
    loading,
    getMenuItems,
    getRolePermissions,
    hasPermission,
    togglePermission,
    setRolePermissions,
  };
}

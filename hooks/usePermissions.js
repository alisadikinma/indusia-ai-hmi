import { useState, useEffect, useCallback } from 'react';
import { permissions as defaultPermissions, menuItems } from '@/data/masterData';

export function usePermissions() {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch permissions from API with fallback to mock data
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Convert API response to { roleId: [menuIds] } format
      const permMap = {};
      if (Array.isArray(json.data)) {
        json.data.forEach(item => {
          if (item.roleId) {
            permMap[item.roleId] = item.menuIds || [];
          }
        });
      }
      setPermissions(permMap);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      setPermissions({ ...defaultPermissions });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const getMenuItems = () => menuItems;

  const getRolePermissions = (roleId) => permissions[roleId] || [];

  const hasPermission = (roleId, menuId) => {
    const rolePerms = getRolePermissions(roleId);
    return rolePerms.includes(menuId);
  };

  const togglePermission = async (roleId, menuId) => {
    const rolePerms = getRolePermissions(roleId);
    const hasIt = rolePerms.includes(menuId);
    const newMenuIds = hasIt
      ? rolePerms.filter(id => id !== menuId)
      : [...rolePerms, menuId];

    await setRolePermissions(roleId, newMenuIds);
  };

  const setRolePermissions = async (roleId, menuIds) => {
    try {
      const res = await fetch(`/api/permissions/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuIds })
      });
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setPermissions(prev => ({
        ...prev,
        [roleId]: menuIds,
      }));
    } catch (err) {
      console.warn('API failed, using local update:', err.message);
      setPermissions(prev => ({
        ...prev,
        [roleId]: menuIds,
      }));
    }
  };

  const refreshPermissions = fetchPermissions;

  return {
    permissions,
    loading,
    error,
    getMenuItems,
    getRolePermissions,
    hasPermission,
    togglePermission,
    setRolePermissions,
    refreshPermissions,
  };
}

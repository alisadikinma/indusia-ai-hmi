import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook for managing role-menu permissions.
 * Fetches roles, menu items, and permissions from the database.
 * All mutations are persisted to DB via API.
 */
export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper: make authenticated fetch with x-user-id header
  const authFetch = useCallback(async (url, options = {}) => {
    if (!user?.id) throw new Error('Not authenticated');
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        ...options.headers,
      },
    });
  }, [user?.id]);

  // Fetch roles from DB
  const fetchRoles = useCallback(async () => {
    const res = await authFetch('/api/roles');
    if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch roles');
    return json.data || [];
  }, [authFetch]);

  // Fetch menu items from DB
  const fetchMenuItems = useCallback(async () => {
    const res = await authFetch('/api/menu-items');
    if (!res.ok) throw new Error(`Failed to fetch menu items: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch menu items');
    return json.data || [];
  }, [authFetch]);

  // Fetch full permissions matrix from DB
  const fetchPermissions = useCallback(async () => {
    const res = await authFetch('/api/permissions');
    if (!res.ok) throw new Error(`Failed to fetch permissions: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch permissions');

    // Convert API response [{roleId, menuIds}] to { roleId: [menuIds] }
    const permMap = {};
    if (Array.isArray(json.data)) {
      json.data.forEach(item => {
        const roleId = item.roleId || item.role_id;
        if (roleId) {
          permMap[roleId] = item.menuIds || item.menu_ids || [];
        }
      });
    }
    return permMap;
  }, [authFetch]);

  // Load all data
  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [rolesData, menuItemsData, permsData] = await Promise.all([
        fetchRoles(),
        fetchMenuItems(),
        fetchPermissions(),
      ]);
      setRoles(rolesData);
      setMenuItems(menuItemsData);
      setPermissions(permsData);
    } catch (err) {
      console.error('[usePermissions] Failed to load:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchRoles, fetchMenuItems, fetchPermissions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const getMenuItems = useCallback(() => menuItems, [menuItems]);

  const getRolePermissions = useCallback(
    (roleId) => permissions[roleId] || [],
    [permissions]
  );

  const hasPermission = useCallback(
    (roleId, menuId) => {
      const rolePerms = permissions[roleId] || [];
      return rolePerms.includes(menuId);
    },
    [permissions]
  );

  // Toggle a single permission and persist to DB
  const togglePermission = useCallback(async (roleId, menuId) => {
    const rolePerms = permissions[roleId] || [];
    const hasIt = rolePerms.includes(menuId);
    const newMenuIds = hasIt
      ? rolePerms.filter(id => id !== menuId)
      : [...rolePerms, menuId];

    // Optimistic update
    const oldPerms = rolePerms;
    setPermissions(prev => ({
      ...prev,
      [roleId]: newMenuIds,
    }));

    try {
      const res = await authFetch(`/api/permissions/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ menuIds: newMenuIds }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to update permissions');
      }
    } catch (err) {
      console.error('[usePermissions] Toggle failed, reverting:', err.message);
      // Revert optimistic update
      setPermissions(prev => ({
        ...prev,
        [roleId]: oldPerms,
      }));
      setError(`Failed to save: ${err.message}`);
    }
  }, [permissions, authFetch]);

  // Set all permissions for a role and persist to DB
  const setRolePermissions = useCallback(async (roleId, menuIds) => {
    const oldPerms = permissions[roleId] || [];

    // Optimistic update
    setPermissions(prev => ({
      ...prev,
      [roleId]: menuIds,
    }));

    try {
      const res = await authFetch(`/api/permissions/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ menuIds }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[usePermissions] Set failed, reverting:', err.message);
      setPermissions(prev => ({
        ...prev,
        [roleId]: oldPerms,
      }));
      setError(`Failed to save: ${err.message}`);
    }
  }, [permissions, authFetch]);

  return {
    permissions,
    roles,
    menuItems,
    loading,
    error,
    getMenuItems,
    getRolePermissions,
    hasPermission,
    togglePermission,
    setRolePermissions,
    refreshPermissions: loadAll,
  };
}

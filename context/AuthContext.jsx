'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * Extract simple role name from various formats
 * - 'superadmin' -> 'superadmin'
 * - 'role_superadmin' -> 'superadmin'
 */
function normalizeRole(roleValue) {
  if (!roleValue) return null;
  return roleValue.replace(/^role_/i, '').toLowerCase();
}

// Mock users for fallback - must match login API mock users
const mockUsers = [
  { id: 'user_admin', name: 'Admin User', email: 'admin@indusia.ai', password: 'admin123', role: 'superadmin', role_id: 'role_superadmin', status: 'active', sections: ['section_smt', 'section_tht', 'section_final'] },
  { id: 'user_manager', name: 'Manager User', email: 'manager@indusia.ai', password: 'manager123', role: 'manager', role_id: 'role_manager', status: 'active', sections: ['section_smt', 'section_tht'] },
  { id: 'user_operator', name: 'Operator User', email: 'operator@indusia.ai', password: 'operator123', role: 'operator', role_id: 'role_operator', status: 'active', sections: ['section_smt'] },
  { id: 'user_engineer', name: 'Engineer User', email: 'engineer@indusia.ai', password: 'engineer123', role: 'engineer', role_id: 'role_engineer', status: 'active', sections: ['section_smt', 'section_tht', 'section_final'] },
];

const AuthContext = createContext(null);

// CSRF token storage key
const CSRF_STORAGE_KEY = 'indusia_csrf_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [csrfToken, setCsrfToken] = useState(null);
  
  // Active inspection session
  const [activeLineId, setActiveLineId] = useState(null);
  const [activeLineName, setActiveLineName] = useState(null);
  
  // Ref to track if CSRF token is being fetched
  const csrfFetchingRef = useRef(false);

  /**
   * Fetch CSRF token from server
   */
  const fetchCSRFToken = useCallback(async () => {
    // Prevent duplicate fetches
    if (csrfFetchingRef.current) return null;
    csrfFetchingRef.current = true;
    
    try {
      const res = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include' // Important: include cookies
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.csrfToken) {
          const token = json.data.csrfToken;
          setCsrfToken(token);
          localStorage.setItem(CSRF_STORAGE_KEY, token);
          return token;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch CSRF token:', err.message);
    } finally {
      csrfFetchingRef.current = false;
    }
    return null;
  }, []);

  /**
   * Get current CSRF token (from state, localStorage, or fetch new one)
   */
  const getCSRFToken = useCallback(async () => {
    // Try state first
    if (csrfToken) return csrfToken;
    
    // Try localStorage
    const storedToken = localStorage.getItem(CSRF_STORAGE_KEY);
    if (storedToken) {
      setCsrfToken(storedToken);
      return storedToken;
    }
    
    // Fetch new token
    return await fetchCSRFToken();
  }, [csrfToken, fetchCSRFToken]);

  /**
   * Make authenticated API request with CSRF token
   */
  const apiRequest = useCallback(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    
    // Get CSRF token for state-changing requests
    let token = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      token = await getCSRFToken();
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add CSRF token header
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
    
    // Add user ID header for authentication (dev mode)
    if (user?.id) {
      headers['x-user-id'] = user.id;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Include cookies
    });
    
    // If CSRF error, refresh token and retry once
    if (response.status === 403) {
      const json = await response.json();
      if (json.code === 'CSRF_ERROR') {
        console.warn('CSRF token expired, refreshing...');
        const newToken = await fetchCSRFToken();
        if (newToken) {
          headers['X-CSRF-Token'] = newToken;
          return fetch(url, {
            ...options,
            headers,
            credentials: 'include'
          });
        }
      }
    }
    
    return response;
  }, [user, getCSRFToken, fetchCSRFToken]);

  // Fetch menu permissions from database
  const fetchMenuPermissions = async (roleId) => {
    if (!roleId) return [];
    try {
      const res = await fetch(`/api/auth/permissions?roleId=${roleId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch menu permissions:', err);
    }
    return [];
  };

  // Normalize user object to ensure consistent role field
  const normalizeUser = (userData) => {
    if (!userData) return null;
    const role = userData.role || normalizeRole(userData.role_id || userData.roleId);
    return { ...userData, role };
  };

  // Restore user session on mount + fetch CSRF token
  useEffect(() => {
    const restoreSession = async () => {
      const storedUserId = localStorage.getItem('indusia_user_id');
      const storedUser = localStorage.getItem('indusia_user');
      const storedActiveLine = localStorage.getItem('indusia_active_line');

      // Restore active line session (sync, no API call)
      if (storedActiveLine) {
        try {
          const parsedLine = JSON.parse(storedActiveLine);
          setActiveLineId(parsedLine.lineId);
          setActiveLineName(parsedLine.lineName);
        } catch (e) {
          localStorage.removeItem('indusia_active_line');
        }
      }

      // Fast path: restore from localStorage immediately so UI renders
      // while we validate with API in parallel
      let restoredFromStorage = false;
      let roleIdForPerms = null;

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const normalizedUser = normalizeUser(parsed);
          setUser(normalizedUser);
          roleIdForPerms = parsed.role_id || parsed.roleId || `role_${normalizedUser.role}`;
          restoredFromStorage = true;
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('indusia_user');
          localStorage.removeItem('indusia_user_id');
        }
      }

      // Run CSRF, permissions, and user validation in parallel
      const promises = [fetchCSRFToken()];
      if (roleIdForPerms) {
        promises.push(fetchMenuPermissions(roleIdForPerms));
      }
      if (storedUserId) {
        promises.push(
          fetch(`/api/auth/me`, { headers: { 'x-user-id': storedUserId } })
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        );
      }

      const results = await Promise.all(promises);

      // Apply permissions (index 1 if roleIdForPerms was set)
      if (roleIdForPerms && results[1]) {
        setMenuPermissions(results[1]);
      }

      // Apply validated user data from API (index 2 if storedUserId was set)
      if (storedUserId && results.length > 2) {
        const json = results[2];
        if (json?.success && json?.data) {
          const selections = storedUser ? JSON.parse(storedUser) : {};
          const validatedUser = normalizeUser({
            ...json.data,
            selectedSectionId: selections.selectedSectionId || null,
            selectedCustomerId: selections.selectedCustomerId || null,
            selectedLineId: selections.selectedLineId || null,
            selectedBoardId: selections.selectedBoardId || null,
          });
          setUser(validatedUser);

          // Re-fetch permissions if role changed
          const newRoleId = json.data.role_id || json.data.roleId || `role_${validatedUser.role}`;
          if (newRoleId !== roleIdForPerms) {
            const perms = await fetchMenuPermissions(newRoleId);
            setMenuPermissions(perms);
          }
        }
      }

      // If nothing was restored at all, clear loading
      if (!restoredFromStorage && !storedUserId) {
        // No stored session
      }

      setIsLoading(false);
    };

    restoreSession();
  }, [fetchCSRFToken]);

  // Login with email and password (API-based login)
  const login = useCallback(async (email, password) => {
    try {
      // Get CSRF token for login request
      const token = await getCSRFToken();
      
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['X-CSRF-Token'] = token;
      }
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (!json.success) {
        return { success: false, error: json.error || 'Login failed' };
      }

      // Update CSRF token from login response
      if (json.data?.csrfToken) {
        setCsrfToken(json.data.csrfToken);
        localStorage.setItem(CSRF_STORAGE_KEY, json.data.csrfToken);
      }

      const loggedInUser = normalizeUser({
        ...json.data.user,
        selectedSectionId: null,
        selectedCustomerId: null,
        selectedLineId: null,
        selectedBoardId: null,
      });

      setUser(loggedInUser);
      localStorage.setItem('indusia_user_id', loggedInUser.id);
      localStorage.setItem('indusia_user', JSON.stringify(loggedInUser));

      const roleId = json.data.user.role_id || json.data.user.roleId || `role_${loggedInUser.role}`;
      const permissions = await fetchMenuPermissions(roleId);
      setMenuPermissions(permissions);

      return { success: true, user: loggedInUser };
    } catch (err) {
      console.warn('API login failed, trying mock auth:', err.message);

      // Fallback to mock users (dev only)
      const mockUser = mockUsers.find(u => u.email === email && u.password === password);
      if (mockUser && mockUser.status === 'active') {
        const { password: _, ...safeUser } = mockUser;
        const loggedInUser = normalizeUser({
          ...safeUser,
          selectedSectionId: null,
          selectedCustomerId: null,
          selectedLineId: null,
          selectedBoardId: null,
        });
        setUser(loggedInUser);
        localStorage.setItem('indusia_user_id', loggedInUser.id);
        localStorage.setItem('indusia_user', JSON.stringify(loggedInUser));
        
        const roleId = mockUser.role_id || `role_${loggedInUser.role}`;
        const permissions = await fetchMenuPermissions(roleId);
        setMenuPermissions(permissions);
        
        return { success: true, user: loggedInUser };
      }

      return { success: false, error: 'Invalid email or password' };
    }
  }, [getCSRFToken]);

  // Legacy login with profile (maintains backward compatibility)
  const loginWithProfile = useCallback((profile, options = {}) => {
    const baseUser = normalizeUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      role_id: profile.role_id,
      sections: profile.sections || [],
      selectedSectionId: null,
      selectedCustomerId: null,
      selectedLineId: null,
      selectedBoardId: null,
    });

    if (profile.role === 'operator') {
      baseUser.selectedSectionId = options.sectionId || null;
      baseUser.selectedCustomerId = options.customerId || null;
      baseUser.selectedLineId = options.lineId || null;
    }

    setUser(baseUser);
    localStorage.setItem('indusia_user_id', baseUser.id);
    localStorage.setItem('indusia_user', JSON.stringify(baseUser));
  }, []);

  // Update user selections (section, customer, line, board)
  const updateSelections = useCallback((selections) => {
    if (!user) return;
    const updatedUser = { ...user, ...selections };
    setUser(updatedUser);
    localStorage.setItem('indusia_user', JSON.stringify(updatedUser));
  }, [user]);

  // Shorthand for updating selected board
  const updateSelectedBoard = useCallback((boardId) => {
    updateSelections({ selectedBoardId: boardId });
  }, [updateSelections]);

  // Set active inspection line (for operators)
  const setActiveLine = useCallback((lineId, lineName) => {
    setActiveLineId(lineId);
    setActiveLineName(lineName);
    localStorage.setItem('indusia_active_line', JSON.stringify({ lineId, lineName }));
  }, []);

  // Clear active inspection line
  const clearActiveLine = useCallback(() => {
    setActiveLineId(null);
    setActiveLineName(null);
    localStorage.removeItem('indusia_active_line');
  }, []);

  // Logout - clear local state immediately, fire API in background
  const logout = useCallback(() => {
    // Clear state instantly (no await = instant UI redirect)
    setUser(null);
    setMenuPermissions([]);
    setCsrfToken(null);
    setActiveLineId(null);
    setActiveLineName(null);
    localStorage.removeItem('indusia_user');
    localStorage.removeItem('indusia_user_id');
    localStorage.removeItem('indusia_active_line');
    localStorage.removeItem(CSRF_STORAGE_KEY);

    // Fire API logout + new CSRF in background (non-blocking)
    apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    fetchCSRFToken().catch(() => {});
  }, [apiRequest, fetchCSRFToken]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const res = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const json = await res.json();
      return { success: json.success, error: json.error };
    } catch (err) {
      console.warn('API change-password failed:', err.message);
      return { success: false, error: 'Failed to change password' };
    }
  }, [user, apiRequest]);

  // Check if user has permission for a menu item
  const hasMenuAccess = useCallback((menuId) => {
    if (!user) return false;
    const normalizedRole = user.role || normalizeRole(user.role_id) || normalizeRole(user.roleId);
    // Super admin always keeps access to admin panel (prevent lockout)
    if (normalizedRole === 'superadmin') {
      const adminPanelMenus = ['menu_users', 'menu_roles', 'menu_permissions'];
      if (adminPanelMenus.includes(menuId)) return true;
    }
    return menuPermissions.includes(menuId);
  }, [user, menuPermissions]);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/auth/me`, {
        headers: { 'x-user-id': user.id }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const refreshedUser = normalizeUser({
            ...json.data,
            selectedSectionId: user.selectedSectionId,
            selectedCustomerId: user.selectedCustomerId,
            selectedLineId: user.selectedLineId,
            selectedBoardId: user.selectedBoardId,
          });
          setUser(refreshedUser);
          localStorage.setItem('indusia_user', JSON.stringify(refreshedUser));
        }
      }
    } catch (err) {
      console.warn('Failed to refresh user:', err.message);
    }
  }, [user]);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithProfile,
    logout,
    updateSelections,
    updateSelectedBoard,
    changePassword,
    hasMenuAccess,
    menuPermissions,
    refreshUser,
    // CSRF
    csrfToken,
    getCSRFToken,
    apiRequest,
    // Active line session
    activeLineId,
    activeLineName,
    setActiveLine,
    clearActiveLine,
    hasActiveLine: !!activeLineId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  const userRole = context.user?.role;
  
  const isSuperAdmin = userRole === 'superadmin';
  const isManager = userRole === 'manager';
  const isEngineer = userRole === 'engineer';
  const isOperator = userRole === 'operator';

  return {
    ...context,
    isSuperAdmin,
    isManager,
    isEngineer,
    isOperator,
  };
}

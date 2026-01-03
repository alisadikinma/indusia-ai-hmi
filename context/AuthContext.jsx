'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  { id: 'user_admin', name: 'Admin User', email: 'admin@indusia.com', password: 'admin123', role: 'superadmin', role_id: 'role_superadmin', status: 'active', sections: ['section_smt', 'section_tht', 'section_final'] },
  { id: 'user_manager', name: 'Manager User', email: 'manager@indusia.com', password: 'manager123', role: 'manager', role_id: 'role_manager', status: 'active', sections: ['section_smt', 'section_tht'] },
  { id: 'user_operator', name: 'Operator User', email: 'operator@indusia.com', password: 'operator123', role: 'operator', role_id: 'role_operator', status: 'active', sections: ['section_smt'] },
  { id: 'user_engineer', name: 'Engineer User', email: 'engineer@indusia.com', password: 'engineer123', role: 'engineer', role_id: 'role_engineer', status: 'active', sections: ['section_smt', 'section_tht', 'section_final'] },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Active inspection session
  const [activeLineId, setActiveLineId] = useState(null);
  const [activeLineName, setActiveLineName] = useState(null);

  // Normalize user object to ensure consistent role field
  const normalizeUser = (userData) => {
    if (!userData) return null;
    
    // Extract role from role_id if role is not set
    const role = userData.role || normalizeRole(userData.role_id || userData.roleId);
    
    return {
      ...userData,
      role, // Always have normalized role
    };
  };

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedUserId = localStorage.getItem('indusia_user_id');
      const storedUser = localStorage.getItem('indusia_user');
      const storedActiveLine = localStorage.getItem('indusia_active_line');

      // Restore active line session
      if (storedActiveLine) {
        try {
          const parsedLine = JSON.parse(storedActiveLine);
          setActiveLineId(parsedLine.lineId);
          setActiveLineName(parsedLine.lineName);
        } catch (e) {
          localStorage.removeItem('indusia_active_line');
        }
      }

      if (storedUserId) {
        try {
          // Try to fetch fresh user data from API
          const res = await fetch(`/api/auth/me?userId=${storedUserId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              // Merge with stored selections (selectedSectionId, etc.)
              const selections = storedUser ? JSON.parse(storedUser) : {};
              const restoredUser = normalizeUser({
                ...json.data,
                selectedSectionId: selections.selectedSectionId || null,
                selectedCustomerId: selections.selectedCustomerId || null,
                selectedLineId: selections.selectedLineId || null,
                selectedBoardId: selections.selectedBoardId || null,
              });
              setUser(restoredUser);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('API failed to restore session:', err.message);
        }
      }

      // Fallback: try to restore from localStorage
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(normalizeUser(parsed));
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('indusia_user');
          localStorage.removeItem('indusia_user_id');
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  // Login with email and password (API-based login)
  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (!json.success) {
        return { success: false, error: json.error || 'Login failed' };
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

      return { success: true, user: loggedInUser };
    } catch (err) {
      console.warn('API login failed, trying mock auth:', err.message);

      // Fallback to mock users
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
        return { success: true, user: loggedInUser };
      }

      return { success: false, error: 'Invalid email or password' };
    }
  }, []);

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
    const updatedUser = {
      ...user,
      ...selections,
    };
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

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('API logout failed:', err.message);
    }
    setUser(null);
    setActiveLineId(null);
    setActiveLineName(null);
    localStorage.removeItem('indusia_user');
    localStorage.removeItem('indusia_user_id');
    localStorage.removeItem('indusia_active_line');
  }, []);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword
        })
      });

      const json = await res.json();
      return { success: json.success, error: json.error };
    } catch (err) {
      console.warn('API change-password failed:', err.message);
      return { success: false, error: 'Failed to change password' };
    }
  }, [user]);

  // Check if user has permission for a menu item
  const hasPermission = useCallback((menuId) => {
    if (!user) return false;
    // Superadmin has all permissions
    if (user.role === 'superadmin') return true;
    // TODO: Check role_menu_permissions when implemented
    // For now, return true for all authenticated users
    return true;
  }, [user]);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/auth/me?userId=${user.id}`);
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
    hasPermission,
    refreshUser,
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

  // Use normalized role for role checks
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

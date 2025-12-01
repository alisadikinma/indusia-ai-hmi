'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Mock users for fallback when API fails
const mockUsers = [
  { id: 'u1', name: 'Admin User', email: 'admin@indusia.com', password: 'admin123', role: 'superadmin', status: 'active', sections: [] },
  { id: 'u2', name: 'Manager User', email: 'manager@indusia.com', password: 'manager123', role: 'manager', status: 'active', sections: ['s1', 's2'] },
  { id: 'u3', name: 'Operator User', email: 'operator@indusia.com', password: 'operator123', role: 'operator', status: 'active', sections: ['s1'] },
  { id: 'u4', name: 'Engineer User', email: 'engineer@indusia.com', password: 'engineer123', role: 'engineer', status: 'active', sections: [] },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedUserId = localStorage.getItem('indusia_user_id');
      const storedUser = localStorage.getItem('indusia_user');

      if (storedUserId) {
        try {
          // Try to fetch fresh user data from API
          const res = await fetch(`/api/auth/me?userId=${storedUserId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              // Merge with stored selections (selectedSectionId, etc.)
              const selections = storedUser ? JSON.parse(storedUser) : {};
              const restoredUser = {
                ...json.data,
                selectedSectionId: selections.selectedSectionId || null,
                selectedCustomerId: selections.selectedCustomerId || null,
                selectedLineId: selections.selectedLineId || null,
                selectedBoardId: selections.selectedBoardId || null,
              };
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
          setUser(JSON.parse(storedUser));
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

  // Login with email and password (new API-based login)
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

      const loggedInUser = {
        ...json.data.user,
        selectedSectionId: null,
        selectedCustomerId: null,
        selectedLineId: null,
        selectedBoardId: null,
      };

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
        const loggedInUser = {
          ...safeUser,
          selectedSectionId: null,
          selectedCustomerId: null,
          selectedLineId: null,
          selectedBoardId: null,
        };
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
    const baseUser = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      sections: profile.sections || [],
      selectedSectionId: null,
      selectedCustomerId: null,
      selectedLineId: null,
      selectedBoardId: null,
    };

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

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('API logout failed:', err.message);
    }
    setUser(null);
    localStorage.removeItem('indusia_user');
    localStorage.removeItem('indusia_user_id');
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
          const refreshedUser = {
            ...json.data,
            selectedSectionId: user.selectedSectionId,
            selectedCustomerId: user.selectedCustomerId,
            selectedLineId: user.selectedLineId,
            selectedBoardId: user.selectedBoardId,
          };
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

  const isSuperAdmin = context.user?.role === 'superadmin';
  const isManager = context.user?.role === 'manager';
  const isEngineer = context.user?.role === 'engineer';
  const isOperator = context.user?.role === 'operator';

  return {
    ...context,
    isSuperAdmin,
    isManager,
    isEngineer,
    isOperator,
  };
}

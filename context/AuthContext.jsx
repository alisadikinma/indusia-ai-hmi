'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('indusia_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('indusia_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithProfile = (profile, options = {}) => {
    const baseUser = {
      id: profile.id,
      name: profile.name,
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
    localStorage.setItem('indusia_user', JSON.stringify(baseUser));
  };

  const updateSelections = (selections) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      ...selections,
    };
    setUser(updatedUser);
    localStorage.setItem('indusia_user', JSON.stringify(updatedUser));
  };

  const updateSelectedBoard = (boardId) => {
    updateSelections({ selectedBoardId: boardId });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('indusia_user');
  };

  return (
    <AuthContext.Provider value={{ user, loginWithProfile, logout, updateSelections, updateSelectedBoard, isLoading }}>
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

  return {
    ...context,
    isSuperAdmin,
  };
}

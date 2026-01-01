'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Layout configurations per role
 * Operator: Fullscreen focus mode - minimal distractions
 * Manager/Engineer/SuperAdmin: Full UI with sidebar and header
 */
const LAYOUT_PRESETS = {
  operator: {
    sidebar: 'hidden',      // 'hidden' | 'collapsed' | 'visible'
    header: 'compact',      // 'compact' | 'full'
    fullscreen: true,
    showSystemHealth: true,
    showNotifications: false,
    autoApproveEnabled: true,
    autoApproveTimeout: 15, // seconds
    theme: 'dark',          // 'dark' | 'light'
  },
  manager: {
    sidebar: 'auto-hide',   // Shows on hover
    header: 'full',
    fullscreen: false,
    showSystemHealth: true,
    showNotifications: true,
    autoApproveEnabled: false,
    autoApproveTimeout: 15,
    theme: 'dark',
  },
  engineer: {
    sidebar: 'visible',
    header: 'full',
    fullscreen: false,
    showSystemHealth: true,
    showNotifications: true,
    autoApproveEnabled: false,
    autoApproveTimeout: 15,
    theme: 'dark',
  },
  superadmin: {
    sidebar: 'visible',
    header: 'full',
    fullscreen: false,
    showSystemHealth: true,
    showNotifications: true,
    autoApproveEnabled: false,
    autoApproveTimeout: 15,
    theme: 'dark',
  },
};

// Default for unauthenticated or unknown roles
const DEFAULT_LAYOUT = LAYOUT_PRESETS.operator;

// LocalStorage key for persisted preferences
const STORAGE_KEY = 'indusia_hmi_layout';

/**
 * useHMILayout - Role-based layout management for HMI interface
 * 
 * Features:
 * - Auto-detects user role and applies appropriate layout
 * - Persists user preferences to localStorage
 * - Provides toggle functions for runtime adjustments
 * - Supports theme switching (dark/light)
 * 
 * @returns {Object} Layout state and control functions
 */
export function useHMILayout() {
  const { user, isOperator, isManager, isEngineer, isSuperAdmin } = useAuth();
  
  // Get role-based default layout
  const roleLayout = useMemo(() => {
    if (isOperator) return LAYOUT_PRESETS.operator;
    if (isManager) return LAYOUT_PRESETS.manager;
    if (isEngineer) return LAYOUT_PRESETS.engineer;
    if (isSuperAdmin) return LAYOUT_PRESETS.superadmin;
    return DEFAULT_LAYOUT;
  }, [isOperator, isManager, isEngineer, isSuperAdmin]);

  // Layout state - initialized from localStorage or role default
  const [layout, setLayout] = useState(() => {
    if (typeof window === 'undefined') return roleLayout;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge stored preferences with role defaults
        return { ...roleLayout, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to parse stored layout:', e);
    }
    return roleLayout;
  });

  // Inspection state
  const [isPaused, setIsPaused] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  // Update layout when role changes
  useEffect(() => {
    setLayout(prev => ({
      ...roleLayout,
      // Preserve user's theme preference
      theme: prev.theme,
    }));
  }, [roleLayout]);

  // Persist layout changes to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Only persist user-modifiable preferences
      const toStore = {
        theme: layout.theme,
        autoApproveTimeout: layout.autoApproveTimeout,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to persist layout:', e);
    }
  }, [layout.theme, layout.autoApproveTimeout]);

  // === Layout Control Functions ===

  /**
   * Toggle sidebar visibility
   */
  const toggleSidebar = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      sidebar: prev.sidebar === 'hidden' ? 'visible' : 
               prev.sidebar === 'visible' ? 'collapsed' : 'hidden',
    }));
  }, []);

  /**
   * Set sidebar state directly
   */
  const setSidebar = useCallback((state) => {
    if (!['hidden', 'collapsed', 'visible', 'auto-hide'].includes(state)) return;
    setLayout(prev => ({ ...prev, sidebar: state }));
  }, []);

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      fullscreen: !prev.fullscreen,
      sidebar: !prev.fullscreen ? 'hidden' : roleLayout.sidebar,
      header: !prev.fullscreen ? 'compact' : roleLayout.header,
    }));
  }, [roleLayout]);

  /**
   * Toggle dark/light theme
   */
  const toggleTheme = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  /**
   * Set theme directly
   */
  const setTheme = useCallback((theme) => {
    if (!['dark', 'light'].includes(theme)) return;
    setLayout(prev => ({ ...prev, theme }));
  }, []);

  /**
   * Toggle header between compact and full
   */
  const toggleHeader = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      header: prev.header === 'compact' ? 'full' : 'compact',
    }));
  }, []);

  /**
   * Set auto-approve timeout (in seconds)
   */
  const setAutoApproveTimeout = useCallback((seconds) => {
    const timeout = Math.max(5, Math.min(60, seconds)); // Clamp between 5-60s
    setLayout(prev => ({ ...prev, autoApproveTimeout: timeout }));
  }, []);

  /**
   * Toggle auto-approve feature
   */
  const toggleAutoApprove = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      autoApproveEnabled: !prev.autoApproveEnabled,
    }));
  }, []);

  /**
   * Pause/Resume inspection
   */
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  /**
   * Start inspection session
   */
  const startInspection = useCallback(() => {
    setIsInspecting(true);
    setIsPaused(false);
  }, []);

  /**
   * Stop inspection session
   */
  const stopInspection = useCallback(() => {
    setIsInspecting(false);
    setIsPaused(false);
  }, []);

  /**
   * Reset layout to role defaults
   */
  const resetLayout = useCallback(() => {
    setLayout(roleLayout);
    localStorage.removeItem(STORAGE_KEY);
  }, [roleLayout]);

  /**
   * Enter operator focus mode (fullscreen, minimal UI)
   */
  const enterFocusMode = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      sidebar: 'hidden',
      header: 'compact',
      fullscreen: true,
    }));
  }, []);

  /**
   * Exit focus mode (restore role defaults)
   */
  const exitFocusMode = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      sidebar: roleLayout.sidebar,
      header: roleLayout.header,
      fullscreen: roleLayout.fullscreen,
    }));
  }, [roleLayout]);

  // === Computed Properties ===

  const isFocusMode = layout.fullscreen && layout.sidebar === 'hidden';
  const isDarkMode = layout.theme === 'dark';
  const isCompactHeader = layout.header === 'compact';
  const isSidebarVisible = layout.sidebar === 'visible';
  const isSidebarHidden = layout.sidebar === 'hidden';
  const isSidebarAutoHide = layout.sidebar === 'auto-hide';

  // Theme colors based on current theme
  const themeColors = useMemo(() => {
    if (isDarkMode) {
      return {
        bg: '#0A1628',
        surface: '#1A2942',
        surfaceAlt: '#0D1B2A',
        border: '#2D3E56',
        text: '#E8EDF2',
        textMuted: '#8A95A8',
        primary: '#0FB5BA',
        pass: '#10B981',
        fail: '#EF4444',
        warning: '#F59E0B',
      };
    }
    // Light mode (ISA-101 compliant)
    return {
      bg: '#E0E0E0',
      surface: '#FFFFFF',
      surfaceAlt: '#F5F5F5',
      border: '#C0C0C0',
      text: '#1A1A1A',
      textMuted: '#666666',
      primary: '#0D9488',
      pass: '#059669',
      fail: '#DC2626',
      warning: '#D97706',
    };
  }, [isDarkMode]);

  return {
    // Layout state
    layout,
    isPaused,
    isInspecting,
    
    // Computed flags
    isFocusMode,
    isDarkMode,
    isCompactHeader,
    isSidebarVisible,
    isSidebarHidden,
    isSidebarAutoHide,
    
    // Theme
    themeColors,
    
    // Role info
    userRole: user?.role || 'operator',
    isOperator,
    isManager,
    isEngineer,
    isSuperAdmin,
    
    // Control functions
    toggleSidebar,
    setSidebar,
    toggleFullscreen,
    toggleTheme,
    setTheme,
    toggleHeader,
    togglePause,
    toggleAutoApprove,
    setAutoApproveTimeout,
    startInspection,
    stopInspection,
    resetLayout,
    enterFocusMode,
    exitFocusMode,
  };
}

export default useHMILayout;

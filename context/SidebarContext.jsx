'use client';

/**
 * Sidebar Context
 * Manages sidebar collapse/expand state and fullscreen mode
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SidebarContext = createContext(undefined);

// Routes that should auto-hide sidebar (fullscreen mode)
const FULLSCREEN_ROUTES = [
  '/inspection/live',
  '/inspection/operator',
  '/inspection/select-line',
];

export function SidebarProvider({ children }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Check if current route should be fullscreen
  const shouldBeFullscreen = useCallback(() => {
    return FULLSCREEN_ROUTES.some(route => pathname?.startsWith(route));
  }, [pathname]);

  // Auto-hide sidebar for fullscreen routes
  useEffect(() => {
    const fullscreen = shouldBeFullscreen();
    setIsFullscreenMode(fullscreen);
    if (fullscreen) {
      setIsHidden(true);
    } else {
      setIsHidden(false);
    }
  }, [pathname, shouldBeFullscreen]);

  // Listen for closeSidebar event (from backdrop click)
  useEffect(() => {
    const handleCloseSidebar = () => {
      if (isFullscreenMode) {
        setIsHidden(true);
      }
    };

    window.addEventListener('closeSidebar', handleCloseSidebar);
    return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
  }, [isFullscreenMode]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const toggleHidden = useCallback(() => {
    setIsHidden(prev => !prev);
  }, []);

  const showSidebar = useCallback(() => {
    setIsHidden(false);
  }, []);

  const hideSidebar = useCallback(() => {
    setIsHidden(true);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isHidden,
        isFullscreenMode,
        toggleCollapse,
        toggleHidden,
        showSidebar,
        hideSidebar,
        expand,
        collapse,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export default SidebarContext;

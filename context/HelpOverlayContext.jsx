'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const HelpOverlayContext = createContext(null);

export function HelpOverlayProvider({ children, defaultContext = 'Global' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('shortcuts');
  const [currentContext, setCurrentContext] = useState(defaultContext);

  const openHelp = useCallback((initialMode = 'shortcuts') => {
    setMode(initialMode);
    setIsOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleHelp = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        openHelp('shortcuts');
      }
      if (e.key === 'Escape' && isOpen) {
        closeHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openHelp, closeHelp]);

  const value = {
    isOpen,
    mode,
    currentContext,
    openHelp,
    closeHelp,
    toggleHelp,
    setMode,
    setCurrentContext,
  };

  return (
    <HelpOverlayContext.Provider value={value}>
      {children}
    </HelpOverlayContext.Provider>
  );
}

export function useHelpOverlayContext() {
  const context = useContext(HelpOverlayContext);
  if (!context) {
    throw new Error('useHelpOverlayContext must be used within HelpOverlayProvider');
  }
  return context;
}

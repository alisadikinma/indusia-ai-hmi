'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';

const SystemHealthContext = createContext(null);

const REFRESH_INTERVAL = 60000; // 60 seconds

const STATE_TYPES = {
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  OFFLINE: 'offline',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown',
  IN_PROGRESS: 'in-progress',
};

const initialStatuses = {
  database: { state: STATE_TYPES.UNKNOWN, message: 'Checking...', lastUpdated: new Date() },
  aiModel: { state: STATE_TYPES.UNKNOWN, message: 'Checking...', lastUpdated: new Date() },
  camera: { state: STATE_TYPES.UNKNOWN, message: 'Checking...', lastUpdated: new Date() },
  cloud: { state: STATE_TYPES.UNKNOWN, message: 'Checking...', lastUpdated: new Date() },
  lastSync: { state: STATE_TYPES.UNKNOWN, message: 'Checking...', lastUpdated: new Date() },
};

export function SystemHealthProvider({ children }) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  // Fetch health status from API
  const fetchHealth = useCallback(async (showNotifications = false) => {
    try {
      const res = await fetch('/api/system-health');
      if (!res.ok) throw new Error('Failed to fetch system health');
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch system health');

      const newStatuses = json.data;
      
      // Check for status changes and notify
      if (showNotifications) {
        Object.keys(newStatuses).forEach(key => {
          const oldState = statuses[key]?.state;
          const newState = newStatuses[key]?.state;
          
          if (oldState && newState && oldState !== newState) {
            const labels = {
              database: 'Database',
              aiModel: 'AI Model',
              camera: 'Camera',
              cloud: 'Cloud',
              lastSync: 'Sync Status',
            };
            
            if (newState === STATE_TYPES.OK && oldState !== STATE_TYPES.OK) {
              showToast(`${labels[key]} restored to normal operation`);
            } else if (newState === STATE_TYPES.ERROR || newState === STATE_TYPES.OFFLINE) {
              showToast(`${labels[key]}: ${newStatuses[key].message}`);
            }
          }
        });
      }

      setStatuses(newStatuses);
      setError(null);
    } catch (err) {
      console.error('[SystemHealth] Fetch error:', err.message);
      setError(err.message);
      
      // Set all to error state on fetch failure
      setStatuses(prev => {
        const errorStatuses = {};
        Object.keys(prev).forEach(key => {
          errorStatuses[key] = {
            ...prev[key],
            state: STATE_TYPES.ERROR,
            message: 'Unable to check status',
            lastUpdated: new Date(),
          };
        });
        return errorStatuses;
      });
    } finally {
      setLoading(false);
    }
  }, [statuses, showToast]);

  // Delayed initial fetch - don't block page render
  useEffect(() => {
    const timer = setTimeout(() => fetchHealth(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHealth(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Manual refresh
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchHealth(false);
    showToast('System status refreshed');
  }, [fetchHealth, showToast]);

  const value = {
    statuses,
    loading,
    error,
    refreshAll,
    STATE_TYPES,
  };

  return (
    <SystemHealthContext.Provider value={value}>
      {children}
    </SystemHealthContext.Provider>
  );
}

export function useSystemHealthContext() {
  const context = useContext(SystemHealthContext);
  if (!context) {
    throw new Error('useSystemHealthContext must be used within SystemHealthProvider');
  }
  return context;
}

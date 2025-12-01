'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';

const SystemHealthContext = createContext(null);

const REFRESH_INTERVAL = 15000;

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
  aiModel: {
    state: STATE_TYPES.OK,
    message: 'Model YOLOv8-custom-v2.1 running',
    lastUpdated: new Date(),
    details: {
      modelName: 'YOLOv8-custom-v2.1',
      lastRetrain: '2024-11-28 03:15:00',
      falseCallRate: '2.3%',
    },
  },
  camera: {
    state: STATE_TYPES.OK,
    message: 'All cameras connected',
    lastUpdated: new Date(),
    details: {
      connectedCameras: ['CAM-01', 'CAM-02', 'CAM-03'],
      lastHeartbeat: new Date(),
    },
  },
  cloud: {
    state: STATE_TYPES.OK,
    message: 'Connected to cloud services',
    lastUpdated: new Date(),
    details: {
      lastPing: new Date(),
      latency: '45ms',
    },
  },
  lineRuntime: {
    state: STATE_TYPES.OK,
    message: 'Line running',
    lastUpdated: new Date(),
    details: {
      status: 'Running',
      uptime: '2h 13m',
      boardsProcessed: 342,
    },
  },
  lastSync: {
    state: STATE_TYPES.OK,
    message: 'Last sync completed successfully',
    lastUpdated: new Date(Date.now() - 180000),
    details: {
      syncedRecords: 156,
      timestamp: new Date(Date.now() - 180000),
    },
  },
};

export function SystemHealthProvider({ children }) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [previousStates, setPreviousStates] = useState({});
  const { showToast } = useToast();

  const simulateRandomChange = useCallback(() => {
    const scenarios = [
      {
        name: 'aiModel',
        state: STATE_TYPES.DEGRADED,
        message: 'Model performance below threshold',
        probability: 0.05,
      },
      {
        name: 'camera',
        state: STATE_TYPES.ERROR,
        message: 'CAM-02 connection lost',
        probability: 0.03,
      },
      {
        name: 'cloud',
        state: STATE_TYPES.OFFLINE,
        message: 'Unable to reach cloud services',
        probability: 0.04,
      },
      {
        name: 'lineRuntime',
        state: STATE_TYPES.WARNING,
        message: 'Line speed reduced',
        probability: 0.02,
      },
    ];

    const recoveryProbability = 0.15;

    setStatuses((prev) => {
      const newStatuses = { ...prev };
      let hasChanges = false;

      Object.keys(newStatuses).forEach((key) => {
        if (key === 'lastSync') return;

        if (newStatuses[key].state !== STATE_TYPES.OK) {
          if (Math.random() < recoveryProbability) {
            const oldState = newStatuses[key].state;
            newStatuses[key] = {
              ...initialStatuses[key],
              lastUpdated: new Date(),
            };
            hasChanges = true;

            setTimeout(() => {
              const labels = {
                aiModel: 'AI Model',
                camera: 'Camera',
                cloud: 'Cloud',
                lineRuntime: 'Line Runtime',
              };
              showToast(`${labels[key]} restored to normal operation`);
            }, 100);
          }
        }
      });

      scenarios.forEach((scenario) => {
        if (
          newStatuses[scenario.name].state === STATE_TYPES.OK &&
          Math.random() < scenario.probability
        ) {
          newStatuses[scenario.name] = {
            ...newStatuses[scenario.name],
            state: scenario.state,
            message: scenario.message,
            lastUpdated: new Date(),
          };
          hasChanges = true;
        }
      });

      if (Math.random() < 0.1) {
        const syncSuccess = Math.random() > 0.2;
        newStatuses.lastSync = {
          state: syncSuccess ? STATE_TYPES.OK : STATE_TYPES.ERROR,
          message: syncSuccess
            ? 'Last sync completed successfully'
            : 'Last sync failed - network timeout',
          lastUpdated: new Date(),
          details: syncSuccess
            ? {
                syncedRecords: Math.floor(Math.random() * 200) + 50,
                timestamp: new Date(),
              }
            : {
                error: 'Network timeout after 30s',
                timestamp: new Date(),
              },
        };
        hasChanges = true;
      }

      return hasChanges ? newStatuses : prev;
    });
  }, [showToast]);

  useEffect(() => {
    const interval = setInterval(() => {
      simulateRandomChange();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [simulateRandomChange]);

  const refreshAll = useCallback(() => {
    setStatuses((prev) => {
      const refreshed = {};
      Object.keys(prev).forEach((key) => {
        refreshed[key] = {
          ...prev[key],
          lastUpdated: new Date(),
        };
      });
      return refreshed;
    });
    showToast('System status refreshed');
  }, [showToast]);

  const simulateDegrade = useCallback(() => {
    setStatuses((prev) => ({
      ...prev,
      aiModel: {
        ...prev.aiModel,
        state: STATE_TYPES.DEGRADED,
        message: 'Model accuracy degraded - retraining recommended',
        lastUpdated: new Date(),
      },
      cloud: {
        ...prev.cloud,
        state: STATE_TYPES.WARNING,
        message: 'High latency detected',
        lastUpdated: new Date(),
      },
    }));
    showToast('Simulated system degradation');
  }, [showToast]);

  const value = {
    statuses,
    refreshAll,
    simulateDegrade,
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

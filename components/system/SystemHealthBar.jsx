'use client';

import { useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useI18n } from '@/context/I18nContext';
import SystemStatusChip from './SystemStatusChip';
import SystemStatusDetailsModal from './SystemStatusDetailsModal';

export default function SystemHealthBar() {
  const { statuses, refreshAll, STATE_TYPES } = useSystemHealth();
  const { t } = useI18n();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshAll();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleChipClick = (systemKey) => {
    setSelectedSystem(systemKey);
    setShowDetailsModal(true);
  };

  const hasErrors = Object.values(statuses).some(
    (status) =>
      status.state === STATE_TYPES.ERROR ||
      status.state === STATE_TYPES.OFFLINE
  );

  const hasWarnings = Object.values(statuses).some(
    (status) =>
      status.state === STATE_TYPES.WARNING ||
      status.state === STATE_TYPES.DEGRADED
  );

  const systemLabels = {
    aiModel: t('systemHealth.aiModel'),
    camera: t('systemHealth.cameraShort'),
    cloud: t('systemHealth.cloudShort'),
    lineRuntime: t('systemHealth.lineShort'),
    lastSync: t('systemHealth.lastSyncShort'),
  };

  return (
    <>
      <div
        className={`
          sticky top-0 z-20 w-full bg-indusia-surface border-b border-indusia-border
          ${hasErrors ? 'shadow-lg' : hasWarnings ? 'shadow-md' : 'shadow-sm'}
          transition-shadow duration-300
        `}
      >
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(statuses).map(([key, status]) => (
              <SystemStatusChip
                key={key}
                label={systemLabels[key]}
                state={status.state}
                message={status.message}
                lastUpdated={status.lastUpdated}
                onClick={() => handleChipClick(key)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors disabled:opacity-50"
              title={t('systemHealth.refreshSystemStatus')}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setSelectedSystem(null);
                setShowDetailsModal(true);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors flex items-center gap-2"
              title={t('systemHealth.viewDetailedDiagnostics')}
            >
              <Info className="w-4 h-4" />
              {t('systemHealth.details')}
            </button>
          </div>
        </div>
      </div>

      <SystemStatusDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        statuses={statuses}
        selectedSystem={selectedSystem}
      />
    </>
  );
}

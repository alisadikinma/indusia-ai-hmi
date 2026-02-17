'use client';

/**
 * Line Selection Page
 * Operator selects production line before entering Live Inspection
 * Flow: Login → Select Line → Live Inspection
 * 
 * Features:
 * - Real-time stats from /api/inspection/stats/[lineId]
 * - Active work order info with customer name
 * - Line status based on work order status
 * - Full i18n support
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { useI18n } from '@/context/I18nContext';
import { authFetch } from '@/lib/utils/authFetch';
import {
  Radio, Activity, ChevronRight, Factory,
  Users, Clock, AlertTriangle, CheckCircle2,
  Cpu, Zap, Settings, Lock, Eye, Menu, LogOut, ChevronDown,
  Package, TrendingUp, XCircle, Building2, RefreshCw,
  Pause, Square, Timer, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeaderInfoBar } from '@/components/inspection/HeaderInfoBar';

// Helper: Format duration from start time to now
function formatDuration(startTime, t) {
  if (!startTime) return null;
  
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  
  if (diffMs < 0) return null;
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}${t('time.days').charAt(0)} ${remainingHours}${t('time.hours').charAt(0)}`;
  } else if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}${t('time.hours').charAt(0)} ${remainingMins}${t('time.minutes').charAt(0)}`;
  } else {
    return `${diffMins}${t('time.minutes').charAt(0)}`;
  }
}

function LineCard({ line, section, isSelected, onSelect, onStartInspection, isStartReady, isLoading, currentUserId, isOperator, t, models, selectedModel, onModelSelect, activeModelName, hasNoActiveWO }) {
  const statusConfig = {
    running: { 
      label: t('lineStatus.running'), 
      icon: Activity,
      bgClass: 'bg-phosphor-green/10 border-phosphor-green/50',
      textClass: 'text-phosphor-green',
      dotClass: 'bg-phosphor-green'
    },
    paused: { 
      label: t('lineStatus.paused'), 
      icon: Pause,
      bgClass: 'bg-phosphor-teal/10 border-phosphor-teal/50',
      textClass: 'text-phosphor-teal',
      dotClass: 'bg-phosphor-teal'
    },
    stopped: { 
      label: t('lineStatus.stopped'), 
      icon: Square,
      bgClass: 'bg-phosphor-red/10 border-phosphor-red/50',
      textClass: 'text-phosphor-red',
      dotClass: 'bg-phosphor-red'
    },
    idle: { 
      label: t('lineStatus.idle'), 
      icon: Clock,
      bgClass: 'bg-surface-border/50 border-surface-border',
      textClass: 'text-text-tertiary',
      dotClass: 'bg-text-tertiary'
    },
    maintenance: { 
      label: t('lineStatus.maintenance'), 
      icon: Settings,
      bgClass: 'bg-phosphor-magenta/10 border-phosphor-magenta/50',
      textClass: 'text-phosphor-magenta',
      dotClass: 'bg-phosphor-magenta'
    },
    offline: { 
      label: t('lineStatus.offline'), 
      icon: AlertTriangle,
      bgClass: 'bg-surface-border/50 border-surface-border',
      textClass: 'text-text-tertiary',
      dotClass: 'bg-text-tertiary'
    },
  };

  const status = statusConfig[line.status] || statusConfig.idle;
  const StatusIcon = status.icon;
  
  const isInUseByOther = line.operatorId && line.operatorId !== currentUserId;
  const isInUseByCurrent = line.operatorId === currentUserId;
  
  const isMaintenanceOrOffline = line.status === 'maintenance' || line.status === 'offline';
  const isDisabledForOperator = isOperator && (isMaintenanceOrOffline || isInUseByOther);
  const isDisabled = isOperator ? isDisabledForOperator : isMaintenanceOrOffline;

  const hasStats = line.inspected > 0 || ['running', 'paused', 'stopped'].includes(line.status);

  return (
    <button
      onClick={() => !isDisabled && onSelect(line)}
      disabled={isDisabled}
      className={cn(
        "w-full text-left p-4 border-2 transition-all duration-200",
        "bg-panel hover:bg-terminal",
        isSelected 
          ? "border-phosphor-teal bg-phosphor-teal/5" 
          : "border-surface-border hover:border-phosphor-teal/50",
        isDisabled && "opacity-50 cursor-not-allowed hover:bg-panel hover:border-surface-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 border flex items-center justify-center",
            isSelected ? "border-phosphor-teal bg-phosphor-teal/10" : "border-surface-border bg-terminal"
          )}>
            <Factory className={cn(
              "w-5 h-5",
              isSelected ? "text-phosphor-teal" : "text-text-secondary"
            )} />
          </div>
          <div>
            <h3 className={cn(
              "font-display font-bold tracking-wide",
              isSelected ? "text-phosphor-teal" : "text-text-primary"
            )}>
              {line.name}
              {line.customerName && (
                <span className="text-phosphor-cyan font-normal text-sm ml-2">
                  - {line.customerName}{line.customerCode && ` (${line.customerCode})`}
                </span>
              )}
            </h3>
            <p className="font-mono text-xs text-text-tertiary">{section?.name}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            status.bgClass
          )}>
            <div className={cn(
              "w-2 h-2",
              status.dotClass,
              line.status === 'running' && "animate-pulse",
              line.status === 'paused' && "animate-pulse"
            )} />
            <StatusIcon size={12} className={status.textClass} />
            <span className={cn("font-mono text-xs font-bold", status.textClass)}>
              {status.label}
            </span>
          </div>
          
          {isInUseByOther && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-phosphor-cyan/50 bg-phosphor-cyan/10">
              <Lock size={12} className="text-phosphor-cyan" />
              <span className="font-mono text-xs font-bold text-phosphor-cyan">{t('lineStatus.inUse')}</span>
            </div>
          )}
          
          {isInUseByCurrent && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-phosphor-green/50 bg-phosphor-green/10">
              <CheckCircle2 size={12} className="text-phosphor-green" />
              <span className="font-mono text-xs font-bold text-phosphor-green">{t('lineStatus.yourSession')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Work Order Info - shown when active WO exists AND board matches */}
      {line.woNumber && selectedModel && !hasNoActiveWO && (
        <div className="mb-3 px-3 py-2 bg-terminal border border-surface-border">
          {/* WO Number Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-phosphor-teal" />
              <span className="font-mono text-xs text-phosphor-teal font-medium">WO: {line.woNumber}</span>
            </div>
            {line.startedAt && (
              <div className="flex items-center gap-1.5">
                <Timer size={12} className="text-text-tertiary" />
                <span className="font-mono text-xxs text-text-secondary">
                  {formatDuration(line.startedAt, t)}
                </span>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {line.lotSize > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xxs text-text-tertiary">{t('lineStats.progress')}</span>
                <span className="font-mono text-xs font-bold text-phosphor-cyan">
                  {line.inspected?.toLocaleString() || 0} / {line.lotSize?.toLocaleString()}
                  <span className="text-text-tertiary font-normal ml-1">
                    ({((line.inspected / line.lotSize) * 100).toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="h-2 bg-surface-border rounded-sm overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    (line.inspected / line.lotSize) >= 0.9 ? "bg-phosphor-green" :
                    (line.inspected / line.lotSize) >= 0.5 ? "bg-phosphor-cyan" :
                    "bg-phosphor-teal"
                  )}
                  style={{ width: `${Math.min((line.inspected / line.lotSize) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid - Show when has active WO or running AND board matches */}
      {hasStats && selectedModel && !hasNoActiveWO && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">{t('lineStats.inspected')}</p>
            <p className="font-mono text-lg font-bold text-phosphor-teal">{line.inspected?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">{t('lineStats.pass')}</p>
            <p className="font-mono text-lg font-bold text-phosphor-green">{line.goodQty?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">{t('lineStats.fail')}</p>
            <p className="font-mono text-lg font-bold text-phosphor-red">{line.ngQty || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">{t('lineStats.yield')}</p>
            <p className={cn(
              "font-mono text-lg font-bold",
              line.yield >= 98 ? "text-phosphor-green" : 
              line.yield >= 95 ? "text-phosphor-teal" : "text-phosphor-red"
            )}>
              {line.yield?.toFixed(1) || 0}%
            </p>
          </div>
        </div>
      )}

      {/* Board Selection - Operators only */}
      {isOperator && (
        <div className="mb-3 px-3 py-2 bg-terminal border border-surface-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Brain size={14} className="text-purple-400" />
            <span className="font-mono text-xxs text-text-tertiary uppercase tracking-wider">
              {t('line.aiModel') || 'Board'}
            </span>
          </div>
          {models?.length > 0 ? (
            <select
              value={selectedModel?.name || ''}
              onChange={(e) => {
                e.stopPropagation();
                const board = models.find(m => m.name === e.target.value);
                onModelSelect(line.id, board || null);
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full bg-void border px-3 py-2 font-mono text-sm text-text-primary",
                "focus:outline-none focus:border-purple-400",
                selectedModel ? "border-purple-400/50" : "border-surface-border"
              )}
            >
              <option value="">{t('line.selectModel') || '-- Select Board --'}</option>
              {models.map(board => {
                const isWoBoard = line.woBoardName === board.name
                const isDisabled = !isWoBoard
                return (
                  <option key={board.id} value={board.name} disabled={isDisabled}>
                    {board.name}{isWoBoard && line.woRemaining > 0 ? ` (${line.woRemaining.toLocaleString()} remaining)` : ''}{isDisabled ? ' — No WO' : ''}
                  </option>
                )
              })}
            </select>
          ) : (
            <div className="px-3 py-2 border border-phosphor-teal/30 bg-phosphor-teal/5 font-mono text-xs text-phosphor-teal">
              {t('line.noModelsAvailable') || 'No boards registered. Add boards via Master Data.'}
            </div>
          )}
        </div>
      )}

      {/* Active Model - View-only for non-operators */}
      {!isOperator && activeModelName && (
        <div className="mb-3 px-3 py-2 bg-terminal border border-surface-border">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-purple-400" />
            <span className="font-mono text-xxs text-text-tertiary uppercase tracking-wider">
              {t('line.aiModel') || 'Board'}
            </span>
            <span className="font-mono text-sm text-purple-400 font-medium ml-auto">
              {activeModelName}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Info */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-border">
        <div className="flex items-center gap-4">
          {line.operatorName && (
            <div className="flex items-center gap-2">
              <Users size={14} className={isInUseByOther ? "text-phosphor-cyan" : "text-text-tertiary"} />
              <span className={cn(
                "font-mono text-xs",
                isInUseByOther ? "text-phosphor-cyan" : "text-text-secondary"
              )}>
                {line.operatorName}
              </span>
            </div>
          )}
          {!line.customerName && !line.operatorName && !line.woNumber && line.inspected === 0 && (
            <span className="font-mono text-xs text-text-tertiary italic">
              {line.status === 'idle' ? t('lineStatus.noActiveWorkOrder') : t('lineStatus.lineUnavailable')}
            </span>
          )}
        </div>

        {isInUseByOther && isOperator && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 text-phosphor-cyan">
            <Lock size={12} />
            <span className="font-display text-xs font-bold tracking-wider">{t('line.locked')}</span>
          </div>
        )}

        {/* START INSPECTION / VIEW button — only when selected and ready */}
        {isSelected && !isDisabled && isStartReady && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartInspection(); }}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-display text-sm font-bold tracking-wider transition-all",
              isOperator
                ? "bg-phosphor-green text-void hover:shadow-glow-green"
                : "bg-phosphor-cyan text-void hover:shadow-glow-cyan"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-void border-t-transparent animate-spin" />
                <span>{t('line.connecting')}</span>
              </>
            ) : (
              <>
                {isOperator ? <Zap size={16} /> : <Eye size={16} />}
                <span>{isOperator ? t('line.startInspection') : t('line.viewInspection')}</span>
                <ChevronRight size={16} />
              </>
            )}
          </button>
        )}

        {/* Warning when selected but no WO */}
        {isSelected && !isDisabled && hasNoActiveWO && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-red/20 text-phosphor-red">
            <AlertTriangle size={12} />
            <span className="font-display text-xs font-bold tracking-wider">NO WO</span>
          </div>
        )}
      </div>
    </button>
  );
}

export default function SelectLinePage() {
  const router = useRouter();
  const { user, isOperator, activeLineId, activeLineName, setActiveLine, hasActiveLine, hasMenuAccess, logout } = useAuth();
  const { showSidebar, isHidden } = useSidebar();
  const { t } = useI18n();
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedLine, setSelectedLine] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Data from API
  const [sections, setSections] = useState([]);
  const [lines, setLines] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [noWoWarning, setNoWoWarning] = useState(null); // Warning when no active WO

  // Load saved model selections from localStorage
  const loadSavedModels = useCallback((modelList) => {
    const saved = {};
    for (const model of modelList) {
      // Check if any line had this model saved
    }
    // Scan localStorage for saved model per line
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('indusia_line_model_'));
      for (const key of keys) {
        const lineId = key.replace('indusia_line_model_', '');
        const data = JSON.parse(localStorage.getItem(key));
        if (data?.modelName) {
          const matchingModel = modelList.find(m => m.name === data.modelName);
          if (matchingModel) {
            saved[lineId] = matchingModel;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved model selections:', e);
    }
    return saved;
  }, []);

  // Handle model selection for a line
  const handleModelSelect = useCallback(async (lineId, model) => {
    setSelectedModels(prev => {
      const next = { ...prev };
      if (model) {
        next[lineId] = model;
        try {
          localStorage.setItem(`indusia_line_model_${lineId}`, JSON.stringify({
            modelName: model.name,
            modelId: model.id,
            selectedAt: new Date().toISOString()
          }));
        } catch (e) { /* ignore */ }
      } else {
        delete next[lineId];
        try { localStorage.removeItem(`indusia_line_model_${lineId}`); } catch (e) { /* ignore */ }
      }
      return next;
    });
    // Auto-select the line when a model is chosen
    if (model) {
      const matchLine = lines.find(l => l.id === lineId);
      if (matchLine) setSelectedLine(matchLine);

      // Check if there's an active WO for this line AND matching the selected board (operator only)
      if (isOperator) {
        try {
          const res = await authFetch(`/api/work-orders/active/${lineId}`);
          const json = await res.json();
          if (!json.success || !json.data) {
            const lineName = matchLine?.name || lineId;
            setNoWoWarning(lineName);
          } else {
            // WO exists but verify it matches the selected board
            const woBoardName = json.data.board?.name || json.data.boardName;
            if (woBoardName && model.name && woBoardName !== model.name) {
              const lineName = matchLine?.name || lineId;
              setNoWoWarning(lineName);
            } else {
              setNoWoWarning(null);
            }
          }
        } catch {
          setNoWoWarning(null); // Don't block on network error
        }
      }
    } else {
      setNoWoWarning(null);
    }
  }, [lines, isOperator]);

  // Fetch all select-line data in a single batch request
  // Replaces 3 base calls + 3 calls per line (N+1) with 1 server-side batch
  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await authFetch('/api/inspection/select-line-data');
      const json = await res.json();

      if (!json.success) {
        console.error('Failed to fetch select-line data:', json.error);
        return;
      }

      const { sections: sData, lines: lData, boards: bData } = json.data;

      setSections(sData || []);
      setModels(bData || []);

      // Enrich with localStorage model name fallback (client-only)
      const enrichedLines = (lData || []).map(line => {
        if (!line.activeModelName) {
          try {
            const saved = JSON.parse(localStorage.getItem(`indusia_line_model_${line.id}`));
            if (saved?.modelName) line.activeModelName = saved.modelName;
          } catch (e) { /* ignore */ }
        }
        return line;
      });

      setLines(enrichedLines);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setDataLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Auto-refresh every 15 seconds (single batch call, no N+1)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !dataLoading) {
        fetchData();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user, dataLoading, fetchData]);

  // Manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Check access via database permissions
  if (!user || !hasMenuAccess('menu_inspection')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">{t('auth.accessDenied')}</h2>
          <p className="text-text-secondary">{t('auth.noPermission')}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOperator && hasActiveLine && activeLineId) {
      // Restore model from localStorage so the live page knows which model to use
      let modelParam = '';
      try {
        const saved = JSON.parse(localStorage.getItem(`indusia_line_model_${activeLineId}`));
        if (saved?.modelName) {
          modelParam = `?model=${encodeURIComponent(saved.modelName)}`;
        }
      } catch (e) { /* ignore */ }
      router.push(`/inspection/live/${activeLineId}${modelParam}`);
    }
  }, [isOperator, hasActiveLine, activeLineId, router]);

  const filteredLines = useMemo(() => {
    if (selectedSection === 'all') return lines;
    return lines.filter(line => line.sectionId === selectedSection);
  }, [selectedSection, lines]);

  const getSection = (sectionId) => sections.find(s => s.id === sectionId);

  const handleStartInspection = () => {
    if (!selectedLine) return;
    const lineModel = selectedModels[selectedLine.id];
    if (isOperator && !lineModel) return;
    if (isOperator && noWoWarning) return;
    setIsLoading(true);

    if (isOperator) {
      setActiveLine(selectedLine.id, selectedLine.name);
    }

    const modelParam = lineModel ? `?model=${encodeURIComponent(lineModel.name)}` : '';
    router.push(`/inspection/live/${selectedLine.id}${modelParam}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <img src="/indusiaai-logo.png" alt="INDUSIA AI" className="w-14 h-14 object-contain animate-pulse-glow mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-3">{t('common.loading')}</h2>
          <p className="text-sm font-mono text-text-tertiary">{t('auth.verifyingCredentials')}</p>
        </div>
      </div>
    );
  }

  if (isOperator && hasActiveLine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <img src="/indusiaai-logo.png" alt="INDUSIA AI" className="w-14 h-14 object-contain animate-pulse-glow mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-phosphor-green mb-3">{t('line.resumingSession')}</h2>
          <p className="text-sm font-mono text-text-tertiary">{t('line.connectingTo', { name: activeLineName })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 bg-panel border-b border-surface-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Hamburger Menu Button */}
          <button
            onClick={showSidebar}
            className="w-10 h-10 border border-surface-border bg-terminal flex items-center justify-center hover:border-phosphor-teal hover:bg-phosphor-teal/10 transition-colors"
            title={t('nav.settings')}
          >
            <Menu className="w-5 h-5 text-phosphor-teal" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-phosphor-teal flex items-center justify-center bg-void">
              <img src="/indusiaai-logo.png" alt="INDUSIA AI" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-wider text-text-primary">
                INDUSIA
              </h1>
              <p className="font-mono text-xxs text-phosphor-teal tracking-widest">
                {t('nav.lineSelection')}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Sync + Notifications + User + Time */}
        <div className="flex items-center gap-4">
          <HeaderInfoBar />

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-phosphor-green animate-pulse" />
            <span className="font-mono text-sm text-phosphor-green">{t('auth.online')}</span>
          </div>
          <span className="font-mono text-sm text-phosphor-teal">{currentTime}</span>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-4 py-2 bg-terminal border border-surface-border hover:border-phosphor-teal/50 transition-colors"
            >
              <div className="w-8 h-8 border border-phosphor-teal/50 bg-void flex items-center justify-center">
                <span className="font-mono text-xs text-phosphor-teal">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left">
                <p className="font-display text-sm text-text-primary">{user.name}</p>
                <p className="font-mono text-xxs text-text-tertiary uppercase">{user.role}</p>
              </div>
              <ChevronDown size={16} className={cn(
                "text-text-tertiary transition-transform",
                showUserMenu && "rotate-180"
              )} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-panel border border-surface-border shadow-lg z-50">
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                    router.push('/login');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-border/30 transition-colors text-phosphor-red"
                >
                  <LogOut size={16} />
                  <span className="font-mono text-sm">{t('auth.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - flex-1 fills remaining space */}
      <main className="flex-1 flex flex-col overflow-hidden px-6 pt-4">
        {/* Page Title + Section Filter row */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-phosphor-teal" />
              <h2 className="font-display text-xl font-bold text-text-primary tracking-wide">
                {t('line.selectTitle')}
              </h2>
              <p className="font-mono text-sm text-text-tertiary ml-2 hidden sm:block">
                {isOperator
                  ? t('line.selectDescription')
                  : t('line.selectDescriptionViewOnly')}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || dataLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-terminal border border-surface-border hover:border-phosphor-teal/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(
                "text-phosphor-teal",
                isRefreshing && "animate-spin"
              )} />
              <span className="font-mono text-xs text-text-secondary">{t('buttons.refresh')}</span>
            </button>
          </div>

          {!isOperator && (
            <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 border border-phosphor-cyan/30 w-fit">
              <Eye size={14} className="text-phosphor-cyan" />
              <span className="font-mono text-xs text-phosphor-cyan">
                {t('line.viewOnlyMode', { role: user.role?.toUpperCase() })}
              </span>
            </div>
          )}

          {/* Section Filter */}
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-text-tertiary">{t('line.filterBySection')}:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSection('all')}
                className={cn(
                  "px-3 py-1.5 font-mono text-xs font-bold border transition-colors",
                  selectedSection === 'all'
                    ? "bg-phosphor-teal text-void border-phosphor-teal"
                    : "bg-terminal text-text-secondary border-surface-border hover:border-phosphor-teal/50"
                )}
              >
                {t('line.allLines')}
              </button>
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={cn(
                    "px-3 py-1.5 font-mono text-xs font-bold border transition-colors",
                    selectedSection === section.id
                      ? "bg-phosphor-teal text-void border-phosphor-teal"
                      : "bg-terminal text-text-secondary border-surface-border hover:border-phosphor-teal/50"
                  )}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lines Grid - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {dataLoading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="text-center">
                  <img src="/indusiaai-logo.png" alt="INDUSIA AI" className="w-14 h-14 object-contain animate-pulse-glow mx-auto mb-4" />
                  <p className="font-mono text-sm text-text-tertiary">{t('line.loadingLines')}</p>
                </div>
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="text-center">
                  <Factory className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                  <p className="font-mono text-sm text-text-tertiary">{t('line.noLinesFound')}</p>
                  <p className="font-mono text-xs text-text-tertiary mt-1">{t('line.addLinesHint')}</p>
                </div>
              </div>
            ) : (
              filteredLines.map(line => (
                <LineCard
                  key={line.id}
                  line={line}
                  section={getSection(line.sectionId)}
                  isSelected={selectedLine?.id === line.id}
                  onSelect={(line) => { setSelectedLine(line); setNoWoWarning(null); }}
                  onStartInspection={handleStartInspection}
                  isStartReady={
                    selectedLine?.id === line.id &&
                    (!isOperator || (selectedModels[line.id] && !noWoWarning))
                  }
                  isLoading={isLoading}
                  currentUserId={user?.id}
                  isOperator={isOperator}
                  t={t}
                  models={models}
                  selectedModel={selectedModels[line.id] || null}
                  onModelSelect={handleModelSelect}
                  activeModelName={line.activeModelName}
                  hasNoActiveWO={!!(selectedLine?.id === line.id && noWoWarning)}
                />
              ))
            )}
          </div>
        </div>
      </main>

    </div>
  );
}

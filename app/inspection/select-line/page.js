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
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { authFetch } from '@/lib/utils/authFetch';
import { 
  Radio, Activity, ChevronRight, Factory, 
  Users, Clock, AlertTriangle, CheckCircle2,
  Cpu, Zap, Settings, Lock, Eye, Menu, LogOut, ChevronDown,
  Package, TrendingUp, XCircle, Building2, RefreshCw,
  Pause, Square, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper: Format duration from start time to now
function formatDuration(startTime) {
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
    return `${diffDays}d ${remainingHours}h`;
  } else if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  } else {
    return `${diffMins}m`;
  }
}

function LineCard({ line, section, isSelected, onSelect, currentUserId, isOperator }) {
  const statusConfig = {
    running: { 
      label: 'RUNNING', 
      icon: Activity,
      bgClass: 'bg-phosphor-green/10 border-phosphor-green/50',
      textClass: 'text-phosphor-green',
      dotClass: 'bg-phosphor-green'
    },
    paused: { 
      label: 'PAUSED', 
      icon: Pause,
      bgClass: 'bg-phosphor-amber/10 border-phosphor-amber/50',
      textClass: 'text-phosphor-amber',
      dotClass: 'bg-phosphor-amber'
    },
    stopped: { 
      label: 'STOPPED', 
      icon: Square,
      bgClass: 'bg-phosphor-red/10 border-phosphor-red/50',
      textClass: 'text-phosphor-red',
      dotClass: 'bg-phosphor-red'
    },
    idle: { 
      label: 'IDLE', 
      icon: Clock,
      bgClass: 'bg-surface-border/50 border-surface-border',
      textClass: 'text-text-tertiary',
      dotClass: 'bg-text-tertiary'
    },
    maintenance: { 
      label: 'MAINTENANCE', 
      icon: Settings,
      bgClass: 'bg-phosphor-magenta/10 border-phosphor-magenta/50',
      textClass: 'text-phosphor-magenta',
      dotClass: 'bg-phosphor-magenta'
    },
    offline: { 
      label: 'OFFLINE', 
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
          ? "border-phosphor-amber bg-phosphor-amber/5" 
          : "border-surface-border hover:border-phosphor-amber/50",
        isDisabled && "opacity-50 cursor-not-allowed hover:bg-panel hover:border-surface-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 border flex items-center justify-center",
            isSelected ? "border-phosphor-amber bg-phosphor-amber/10" : "border-surface-border bg-terminal"
          )}>
            <Factory className={cn(
              "w-5 h-5",
              isSelected ? "text-phosphor-amber" : "text-text-secondary"
            )} />
          </div>
          <div>
            <h3 className={cn(
              "font-display font-bold tracking-wide",
              isSelected ? "text-phosphor-amber" : "text-text-primary"
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
              <span className="font-mono text-xs font-bold text-phosphor-cyan">IN USE</span>
            </div>
          )}
          
          {isInUseByCurrent && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-phosphor-green/50 bg-phosphor-green/10">
              <CheckCircle2 size={12} className="text-phosphor-green" />
              <span className="font-mono text-xs font-bold text-phosphor-green">YOUR SESSION</span>
            </div>
          )}
        </div>
      </div>

      {/* Work Order Info - shown when active WO exists */}
      {line.woNumber && (
        <div className="mb-3 px-3 py-2 bg-terminal border border-surface-border">
          {/* WO Number Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-phosphor-amber" />
              <span className="font-mono text-xs text-phosphor-amber font-medium">WO: {line.woNumber}</span>
            </div>
            {line.startedAt && (
              <div className="flex items-center gap-1.5">
                <Timer size={12} className="text-text-tertiary" />
                <span className="font-mono text-xxs text-text-secondary">
                  {formatDuration(line.startedAt)}
                </span>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {line.lotSize > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xxs text-text-tertiary">PROGRESS</span>
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
                    "bg-phosphor-amber"
                  )}
                  style={{ width: `${Math.min((line.inspected / line.lotSize) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid - Show when has active WO or running */}
      {hasStats && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">INSPECTED</p>
            <p className="font-mono text-lg font-bold text-phosphor-amber">{line.inspected?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">PASS</p>
            <p className="font-mono text-lg font-bold text-phosphor-green">{line.goodQty?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">FAIL</p>
            <p className="font-mono text-lg font-bold text-phosphor-red">{line.ngQty || 0}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2 text-center">
            <p className="font-mono text-xxs text-text-tertiary">YIELD</p>
            <p className={cn(
              "font-mono text-lg font-bold",
              line.yield >= 98 ? "text-phosphor-green" : 
              line.yield >= 95 ? "text-phosphor-amber" : "text-phosphor-red"
            )}>
              {line.yield?.toFixed(1) || 0}%
            </p>
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
              {line.status === 'idle' ? 'No active work order' : 'Line unavailable'}
            </span>
          )}
        </div>

        {!isDisabled && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 transition-colors",
            isSelected 
              ? "bg-phosphor-amber text-void" 
              : "bg-surface-border/50 text-text-secondary"
          )}>
            {!isOperator && <Eye size={12} />}
            <span className="font-display text-xs font-bold tracking-wider">
              {isSelected ? 'SELECTED' : isOperator ? 'SELECT' : 'VIEW'}
            </span>
            <ChevronRight size={14} />
          </div>
        )}
        
        {isInUseByOther && isOperator && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 text-phosphor-cyan">
            <Lock size={12} />
            <span className="font-display text-xs font-bold tracking-wider">LOCKED</span>
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
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedLine, setSelectedLine] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Data from API
  const [sections, setSections] = useState([]);
  const [lines, setLines] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch sections, lines, and active WO data
  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      // Fetch sections and lines
      const [sectionsRes, linesRes] = await Promise.all([
        authFetch('/api/master-data/sections'),
        authFetch('/api/master-data/lines')
      ]);
      
      const sectionsData = await sectionsRes.json();
      const linesData = await linesRes.json();
      
      if (sectionsData.success) {
        setSections(sectionsData.data || []);
      }
      
      if (linesData.success) {
        const linesList = linesData.data || [];
        
        // Fetch stats and active WO for each line
        const linesWithStats = await Promise.all(
          linesList.map(async (line) => {
            const lineData = {
              id: line.id,
              name: line.name,
              sectionId: line.sectionId || line.section_id,
              customerId: line.customerId || line.customer_id,
              status: 'idle',
              customerName: line.customer?.name || null, // Default from master data
              customerCode: line.customer?.code || null,
              woNumber: null,
              lotSize: 0,
              startedAt: null,
              operatorId: null,
              operatorName: null,
              inspected: 0,
              goodQty: 0,
              ngQty: 0,
              yield: 0
            };

            try {
              // Fetch active work order for this line
              const woRes = await authFetch(`/api/work-orders/active/${line.id}`);
              const woData = await woRes.json();
              
              if (woData.success && woData.data) {
                const wo = woData.data;
                lineData.status = 'running';
                lineData.customerName = wo.customer?.name || lineData.customerName;
                lineData.customerCode = wo.customer?.code || lineData.customerCode;
                lineData.woNumber = wo.woNumber;
                lineData.lotSize = wo.lotSize || 0;
                lineData.startedAt = wo.startedAt || wo.started_at || wo.createdAt || wo.created_at;
                lineData.inspected = wo.completedQty || 0;
                lineData.goodQty = wo.goodQty || 0;
                lineData.ngQty = wo.ngQty || 0;
                lineData.yield = lineData.inspected > 0 
                  ? ((lineData.goodQty / lineData.inspected) * 100) 
                  : 0;
              }

              // Optionally fetch today's stats (shift-based)
              const statsRes = await authFetch(`/api/inspection/stats/${line.id}`);
              const statsData = await statsRes.json();
              
              if (statsData.success && statsData.data) {
                const data = statsData.data;
                const stats = data.stats || {};
                const total = stats.total || 0;
                
                // Use stats if available
                if (total > 0) {
                  lineData.inspected = total;
                  lineData.goodQty = stats.passed || 0;
                  lineData.ngQty = stats.failed || 0;
                  lineData.yield = parseFloat(stats.yield) || 0;
                  
                  // Get WO info from stats if available
                  if (data.workOrder?.woNumber) {
                    lineData.woNumber = data.workOrder.woNumber;
                  }
                  if (data.workOrder?.lotSize) {
                    lineData.lotSize = data.workOrder.lotSize;
                  }
                  if (data.workOrder?.startedAt || data.workOrder?.started_at) {
                    lineData.startedAt = data.workOrder.startedAt || data.workOrder.started_at;
                  }
                }
              }
              
              // Fetch line-state for ACTUAL machine status (RUNNING/PAUSED/STOPPED/IDLE)
              const lineStateRes = await authFetch(`/api/inspection/line-state/${line.id}`);
              const lineStateData = await lineStateRes.json();
              
              if (lineStateData.success && lineStateData.data) {
                const processStatus = lineStateData.data.processStatus || 'IDLE';
                
                // Map processStatus to UI status
                const statusMap = {
                  'RUNNING': 'running',
                  'PAUSED': 'paused',
                  'STOPPED': 'stopped',
                  'IDLE': 'idle',
                  'READY': 'idle'
                };
                
                lineData.status = statusMap[processStatus] || 'idle';
                
                // Get operator info from line-state if available
                if (lineStateData.data.updatedBy) {
                  lineData.operatorName = lineStateData.data.updatedBy;
                }
              } else if (lineData.woNumber) {
                // Fallback: if no line-state but has WO, assume idle (WO assigned but not started)
                lineData.status = 'idle';
              }
            } catch (err) {
              console.warn(`Failed to fetch data for line ${line.id}:`, err);
            }

            return lineData;
          })
        );
        
        setLines(linesWithStats);
      }
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

  // Auto-refresh every 10 seconds for real-time machine status
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !dataLoading) {
        fetchData();
      }
    }, 10000);
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
          <h2 className="text-lg font-semibold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary">You don&apos;t have permission to access this page.</p>
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
      router.push(`/inspection/live/${activeLineId}`);
    }
  }, [isOperator, hasActiveLine, activeLineId, router]);

  const filteredLines = useMemo(() => {
    if (selectedSection === 'all') return lines;
    return lines.filter(line => line.sectionId === selectedSection);
  }, [selectedSection, lines]);

  const getSection = (sectionId) => sections.find(s => s.id === sectionId);

  const handleStartInspection = () => {
    if (!selectedLine) return;
    setIsLoading(true);
    
    if (isOperator) {
      setActiveLine(selectedLine.id, selectedLine.name);
    }
    
    router.push(`/inspection/live/${selectedLine.id}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-3">LOADING...</h2>
          <p className="text-sm font-mono text-text-tertiary">Verifying credentials</p>
        </div>
      </div>
    );
  }

  if (isOperator && hasActiveLine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <div className="w-8 h-8 border-2 border-phosphor-green border-t-transparent animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-phosphor-green mb-3">RESUMING SESSION</h2>
          <p className="text-sm font-mono text-text-tertiary">Connecting to {activeLineName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="h-14 bg-panel border-b border-surface-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Hamburger Menu Button */}
          <button
            onClick={showSidebar}
            className="w-10 h-10 border border-surface-border bg-terminal flex items-center justify-center hover:border-phosphor-amber hover:bg-phosphor-amber/10 transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 text-phosphor-amber" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-phosphor-amber flex items-center justify-center bg-terminal">
              <span className="font-display font-bold text-lg text-phosphor-amber">IN</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-wider text-text-primary">
                INDUSIA
              </h1>
              <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
                LINE SELECTION
              </p>
            </div>
          </div>
        </div>

        {/* Right: User + Time */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-phosphor-green animate-pulse" />
            <span className="font-mono text-sm text-phosphor-green">ONLINE</span>
          </div>
          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>
          
          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-4 py-2 bg-terminal border border-surface-border hover:border-phosphor-amber/50 transition-colors"
            >
              <div className="w-8 h-8 border border-phosphor-amber/50 bg-void flex items-center justify-center">
                <span className="font-mono text-xs text-phosphor-amber">
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
                  <span className="font-mono text-sm">LOGOUT</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Page Title */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-phosphor-amber" />
              <h2 className="font-display text-2xl font-bold text-text-primary tracking-wide">
                SELECT PRODUCTION LINE
              </h2>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || dataLoading}
              className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border hover:border-phosphor-amber/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(
                "text-phosphor-amber",
                isRefreshing && "animate-spin"
              )} />
              <span className="font-mono text-xs text-text-secondary">REFRESH</span>
            </button>
          </div>
          <p className="font-mono text-sm text-text-tertiary">
            {isOperator 
              ? 'Choose a production line to begin live inspection monitoring'
              : 'Select a line to view inspection (view-only mode)'}
          </p>
          
          {!isOperator && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-phosphor-cyan/10 border border-phosphor-cyan/30 w-fit">
              <Eye size={16} className="text-phosphor-cyan" />
              <span className="font-mono text-xs text-phosphor-cyan">
                VIEW-ONLY MODE — Actions disabled for {user.role?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Section Filter */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-text-tertiary">FILTER BY SECTION:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSection('all')}
              className={cn(
                "px-4 py-2 font-mono text-xs font-bold border transition-colors",
                selectedSection === 'all'
                  ? "bg-phosphor-amber text-void border-phosphor-amber"
                  : "bg-terminal text-text-secondary border-surface-border hover:border-phosphor-amber/50"
              )}
            >
              ALL LINES
            </button>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={cn(
                  "px-4 py-2 font-mono text-xs font-bold border transition-colors",
                  selectedSection === section.id
                    ? "bg-phosphor-amber text-void border-phosphor-amber"
                    : "bg-terminal text-text-secondary border-surface-border hover:border-phosphor-amber/50"
                )}
              >
                {section.name}
              </button>
            ))}
          </div>
        </div>

        {/* Lines Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {dataLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-phosphor-amber border-t-transparent animate-spin mx-auto mb-4" />
                <p className="font-mono text-sm text-text-tertiary">Loading production lines...</p>
              </div>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="text-center">
                <Factory className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="font-mono text-sm text-text-tertiary">No production lines found</p>
                <p className="font-mono text-xs text-text-tertiary mt-1">Add lines in Master Data management</p>
              </div>
            </div>
          ) : (
            filteredLines.map(line => (
              <LineCard
                key={line.id}
                line={line}
                section={getSection(line.sectionId)}
                isSelected={selectedLine?.id === line.id}
                onSelect={setSelectedLine}
                currentUserId={user?.id}
                isOperator={isOperator}
              />
            ))
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-panel border-t border-surface-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {selectedLine ? (
              <div className="flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-phosphor-green" />
                <div>
                  <p className="font-display font-bold text-text-primary">
                    {selectedLine.name} Selected
                  </p>
                  <p className="font-mono text-xs text-text-tertiary">
                    {getSection(selectedLine.sectionId)?.name}
                    {selectedLine.customerName && ` • ${selectedLine.customerName}${selectedLine.customerCode ? ` (${selectedLine.customerCode})` : ''}`}
                    {!isOperator && ' • View-only mode'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-6 h-6 text-phosphor-amber" />
                <div>
                  <p className="font-display font-bold text-phosphor-amber">
                    No Line Selected
                  </p>
                  <p className="font-mono text-xs text-text-tertiary">
                    Select a production line to continue
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStartInspection}
            disabled={!selectedLine || isLoading}
            className={cn(
              "h-14 px-8 font-display text-lg font-bold tracking-wider flex items-center gap-3 transition-all",
              selectedLine
                ? isOperator 
                  ? "bg-phosphor-green text-void hover:shadow-glow-green"
                  : "bg-phosphor-cyan text-void hover:shadow-glow-cyan"
                : "bg-surface-border text-text-tertiary cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-void border-t-transparent animate-spin" />
                <span>CONNECTING...</span>
              </>
            ) : (
              <>
                {isOperator ? <Zap className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span>{isOperator ? 'START INSPECTION' : 'VIEW INSPECTION'}</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-24" />
      </main>
    </div>
  );
}

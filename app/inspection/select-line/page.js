'use client';

/**
 * Line Selection Page
 * Operator selects production line before entering Live Inspection
 * Flow: Login → Select Line → Live Inspection
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { 
  Radio, Activity, ChevronRight, Factory, 
  Users, Clock, AlertTriangle, CheckCircle2,
  Cpu, Zap, Settings, Lock, Eye, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data - akan diganti dengan API call
const mockSections = [
  { id: 'sec-1', name: 'Section A - SMT', customerId: 'cust-1' },
  { id: 'sec-2', name: 'Section B - THT', customerId: 'cust-1' },
  { id: 'sec-3', name: 'Section C - Assembly', customerId: 'cust-2' },
];

const mockLines = [
  { 
    id: '1', 
    name: 'SMT Line 01', 
    sectionId: 'sec-1',
    status: 'running',
    currentBoard: 'PCB-2024-0847',
    operatorId: 'user_other',
    operatorName: 'John D.',
    shift: 'Day Shift',
    inspected: 1247,
    defects: 23,
    yield: 98.2
  },
  { 
    id: '2', 
    name: 'SMT Line 02', 
    sectionId: 'sec-1',
    status: 'idle',
    currentBoard: null,
    operatorId: null,
    operatorName: null,
    shift: 'Day Shift',
    inspected: 0,
    defects: 0,
    yield: 0
  },
  { 
    id: '3', 
    name: 'SMT Line 03', 
    sectionId: 'sec-1',
    status: 'running',
    currentBoard: 'PCB-2024-0851',
    operatorId: null,
    operatorName: null,
    shift: 'Day Shift',
    inspected: 892,
    defects: 12,
    yield: 98.7
  },
  { 
    id: '4', 
    name: 'THT Line 01', 
    sectionId: 'sec-2',
    status: 'maintenance',
    currentBoard: null,
    operatorId: null,
    operatorName: null,
    shift: null,
    inspected: 0,
    defects: 0,
    yield: 0
  },
  { 
    id: '5', 
    name: 'THT Line 02', 
    sectionId: 'sec-2',
    status: 'running',
    currentBoard: 'PCB-2024-0849',
    operatorId: null,
    operatorName: null,
    shift: 'Day Shift',
    inspected: 654,
    defects: 8,
    yield: 98.8
  },
];

function LineCard({ line, section, isSelected, onSelect, currentUserId, isOperator }) {
  const statusConfig = {
    running: { 
      label: 'RUNNING', 
      icon: Activity,
      bgClass: 'bg-phosphor-green/10 border-phosphor-green/50',
      textClass: 'text-phosphor-green',
      dotClass: 'bg-phosphor-green'
    },
    idle: { 
      label: 'IDLE', 
      icon: Clock,
      bgClass: 'bg-phosphor-amber/10 border-phosphor-amber/50',
      textClass: 'text-phosphor-amber',
      dotClass: 'bg-phosphor-amber'
    },
    maintenance: { 
      label: 'MAINTENANCE', 
      icon: Settings,
      bgClass: 'bg-phosphor-red/10 border-phosphor-red/50',
      textClass: 'text-phosphor-red',
      dotClass: 'bg-phosphor-red'
    },
    offline: { 
      label: 'OFFLINE', 
      icon: AlertTriangle,
      bgClass: 'bg-surface-border/50 border-surface-border',
      textClass: 'text-text-tertiary',
      dotClass: 'bg-text-tertiary'
    },
  };

  const status = statusConfig[line.status] || statusConfig.offline;
  const StatusIcon = status.icon;
  
  const isInUseByOther = line.operatorId && line.operatorId !== currentUserId;
  const isInUseByCurrent = line.operatorId === currentUserId;
  
  const isMaintenanceOrOffline = line.status === 'maintenance' || line.status === 'offline';
  const isDisabledForOperator = isOperator && (isMaintenanceOrOffline || isInUseByOther);
  const isDisabled = isOperator ? isDisabledForOperator : isMaintenanceOrOffline;

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
              line.status === 'running' && "animate-pulse"
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

      {/* Stats Grid */}
      {line.status === 'running' && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-terminal border border-surface-border p-2">
            <p className="font-mono text-xxs text-text-tertiary">INSPECTED</p>
            <p className="font-mono text-lg font-bold text-phosphor-amber">{line.inspected.toLocaleString()}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2">
            <p className="font-mono text-xxs text-text-tertiary">DEFECTS</p>
            <p className="font-mono text-lg font-bold text-phosphor-red">{line.defects}</p>
          </div>
          <div className="bg-terminal border border-surface-border p-2">
            <p className="font-mono text-xxs text-text-tertiary">YIELD</p>
            <p className={cn(
              "font-mono text-lg font-bold",
              line.yield >= 98 ? "text-phosphor-green" : 
              line.yield >= 95 ? "text-phosphor-amber" : "text-phosphor-red"
            )}>
              {line.yield}%
            </p>
          </div>
        </div>
      )}

      {/* Current Info */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-border">
        <div className="flex items-center gap-4">
          {line.currentBoard && (
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-text-tertiary" />
              <span className="font-mono text-xs text-text-secondary">{line.currentBoard}</span>
            </div>
          )}
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
          {!line.currentBoard && !line.operatorName && (
            <span className="font-mono text-xs text-text-tertiary italic">
              {line.status === 'idle' ? 'Waiting for operation' : 'Line unavailable'}
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
  const { user, isOperator, activeLineId, activeLineName, setActiveLine, hasActiveLine } = useAuth();
  const { showSidebar, isHidden } = useSidebar();
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedLine, setSelectedLine] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    if (selectedSection === 'all') return mockLines;
    return mockLines.filter(line => line.sectionId === selectedSection);
  }, [selectedSection]);

  const getSection = (sectionId) => mockSections.find(s => s.id === sectionId);

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
          <div className="flex items-center gap-3 px-4 py-2 bg-terminal border border-surface-border">
            <div className="w-8 h-8 border border-phosphor-amber/50 bg-void flex items-center justify-center">
              <span className="font-mono text-xs text-phosphor-amber">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="font-display text-sm text-text-primary">{user.name}</p>
              <p className="font-mono text-xxs text-text-tertiary uppercase">{user.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Page Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-5 h-5 text-phosphor-amber" />
            <h2 className="font-display text-2xl font-bold text-text-primary tracking-wide">
              SELECT PRODUCTION LINE
            </h2>
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
            {mockSections.map(section => (
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
          {filteredLines.map(line => (
            <LineCard
              key={line.id}
              line={line}
              section={getSection(line.sectionId)}
              isSelected={selectedLine?.id === line.id}
              onSelect={setSelectedLine}
              currentUserId={user?.id}
              isOperator={isOperator}
            />
          ))}
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

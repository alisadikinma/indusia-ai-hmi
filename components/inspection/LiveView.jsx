'use client';

/**
 * Live View Component - ISA-101 Compliant HMI
 * Control Room Brutalism Design
 * Real-time inspection monitoring with auto-approve feature
 * 
 * Roles:
 * - Operator: Can approve/reject/false call
 * - Other roles: View-only mode
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Menu, HelpCircle, AlertTriangle, Video,
  ZoomIn, ZoomOut, Move, Maximize2, Minimize2,
  Check, X, Pause, Play, Radio, Activity, Eye,
  ChevronLeft, ChevronRight, Flag, Square, Settings,
  Sun, Moon, PanelLeft, EyeOff
} from 'lucide-react';
import { useLiveInspection } from '@/hooks/useLiveInspection';
import { useSidebar } from '@/context/SidebarContext';
import { useI18n } from '@/context/I18nContext';
import { DetectionOverlay } from './DetectionOverlay';
import FalseCallOverrideModal from './FalseCallOverrideModal';
import { cn } from '@/lib/utils';

/**
 * Circular Auto-Approve Timer
 */
function AutoApproveTimer({ 
  duration = 10, 
  isPaused = false, 
  onTimeout, 
  confidence = 0,
  confidenceThreshold = 85,
  size = 100,
  disabled = false 
}) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const isActive = confidence >= confidenceThreshold && !isPaused && !disabled;

  // Reset when confidence changes
  useEffect(() => {
    setTimeLeft(duration);
  }, [duration, confidence]);

  // Countdown
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeout?.();
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, duration, onTimeout]);

  // SVG calculations
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = isActive ? (timeLeft / duration) : 1;
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on time
  const getColor = () => {
    if (disabled) return 'var(--text-tertiary)';
    if (!isActive) return 'var(--text-tertiary)';
    if (timeLeft > 5) return 'var(--phosphor-teal)';
    if (timeLeft > 2) return 'var(--phosphor-teal-bright)';
    return 'var(--phosphor-red)';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--surface-border)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor()}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="square"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {disabled ? (
            <EyeOff size={size * 0.25} className="text-text-tertiary" />
          ) : isActive ? (
            <>
              <span 
                className="font-mono font-bold"
                style={{ fontSize: size * 0.4, color: getColor(), lineHeight: 1 }}
              >
                {timeLeft}
              </span>
              <span className="font-mono text-xs text-text-tertiary">sec</span>
            </>
          ) : (
            <Pause size={size * 0.3} className="text-text-tertiary" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Detection Legend Overlay
 */
function DetectionLegend({ detections = [] }) {
  const { t } = useI18n();
  const counts = {
    critical: detections.filter(d => d.severity === 'critical' || d.class_name?.includes('bridge') || d.class_name?.includes('short')).length,
    warning: detections.filter(d => d.severity === 'warning' || d.class_name?.includes('bite')).length,
    info: detections.filter(d => d.severity === 'info' || d.class_name?.includes('copper')).length,
  };

  // Only show if there are detections
  if (detections.length === 0) return null;

  return (
    <div className="absolute top-14 right-4 z-10 bg-panel/95 border border-surface-border p-3 backdrop-blur">
      <div className="font-display text-xs font-bold text-text-tertiary tracking-wider mb-2">
        {t('inspection.detected')}
      </div>
      <div className="space-y-2">
        {counts.critical > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-phosphor-red" />
            <span className="font-mono text-xs text-text-primary">{t('inspection.critical')} ({counts.critical})</span>
          </div>
        )}
        {counts.warning > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-phosphor-teal" />
            <span className="font-mono text-xs text-text-primary">{t('inspection.warningLevel')} ({counts.warning})</span>
          </div>
        )}
        {counts.info > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-phosphor-cyan" />
            <span className="font-mono text-xs text-text-primary">{t('inspection.infoLevel')} ({counts.info})</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LiveView({
  lineId,
  lineName,
  sectionId,
  customerId,
  user,
  onExit,
  isOperator = false, // Only operators can perform actions
}) {
  // i18n
  const { t } = useI18n();

  // Sidebar context
  const { isHidden, toggleHidden } = useSidebar();

  // State
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFalseCallModal, setShowFalseCallModal] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [autoApproveDuration, setAutoApproveDuration] = useState(10);

  // Live inspection hook
  const {
    connected,
    connecting,
    currentFrame,
    stats,
    error,
    connect,
    disconnect,
  } = useLiveInspection(lineId);

  // Extract detection data
  const detection = currentFrame?.detections?.[0] || {};
  const defectType = detection.class_name || 'SCANNING...';
  const confidence = Math.round((detection.confidence || 0) * 100);
  const boardId = currentFrame?.board_id || 'PCB-0000-0000';
  const batchId = currentFrame?.batch_id || 'BATCH-0000';

  // Calculate stats
  const totalInspected = stats.pass + stats.fail + stats.review;
  const yieldRate = totalInspected > 0
    ? ((stats.pass / totalInspected) * 100).toFixed(1)
    : '0.0';

  // Historical accuracy (mock for now)
  const historicalAccuracy = 94;

  // Actions disabled for non-operators
  const actionsDisabled = !isOperator || isPaused || !connected;

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Action handlers - only for operators
  const handleApprove = useCallback(() => {
    if (!isOperator) return;
    console.log('Approved:', boardId);
    // TODO: API call
  }, [boardId, isOperator]);

  const handleReject = useCallback(() => {
    if (!isOperator) return;
    console.log('Rejected:', boardId);
    // TODO: API call
  }, [boardId, isOperator]);

  const handleFalseCall = useCallback(() => {
    if (!isOperator) return;
    setShowFalseCallModal(true);
  }, [isOperator]);

  const handleAutoApprove = useCallback(() => {
    if (!isOperator) return;
    console.log('Auto-approved:', boardId);
    handleApprove();
  }, [boardId, handleApprove, isOperator]);

  const handleStop = useCallback(() => {
    disconnect();
    if (onExit) onExit();
  }, [disconnect, onExit]);

  const togglePause = () => setIsPaused(!isPaused);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcuts - actions only for operators
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFalseCallModal) return;

      switch (e.key.toLowerCase()) {
        case 'a':
          if (isOperator && !isPaused && connected) handleApprove();
          break;
        case 'r':
          if (isOperator && !isPaused && connected) handleReject();
          break;
        case 'f':
          if (isOperator && !isPaused && connected) handleFalseCall();
          break;
        case 'm':
          toggleHidden();
          break;
        case ' ':
          e.preventDefault();
          togglePause();
          break;
        case 'escape':
          if (isFullscreen) toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, connected, showFalseCallModal, isFullscreen, handleApprove, handleReject, handleFalseCall, toggleHidden, isOperator]);

  // Status config
  const getStatusConfig = () => {
    if (isPaused) return { color: 'phosphor-cyan', label: t('inspection.paused'), icon: Pause };
    if (connected) return { color: 'phosphor-green', label: isOperator ? t('inspection.inspecting') : t('inspection.viewing'), icon: isOperator ? Activity : Eye };
    if (connecting) return { color: 'phosphor-teal', label: t('inspection.connecting'), icon: Radio };
    return { color: 'phosphor-red', label: t('inspection.offline'), icon: AlertTriangle };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="h-screen bg-void flex flex-col font-sans select-none">
      {/* === HEADER BAR === */}
      <header className="h-12 bg-panel border-b border-surface-border flex items-center justify-between px-4 shrink-0">
        {/* Left: Menu + Board/Batch Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleHidden}
            className="p-2 border border-surface-border bg-terminal hover:border-phosphor-teal hover:text-phosphor-teal transition-colors"
            title={isHidden ? t('inspection.showMenu') : t('inspection.hideMenu')}
          >
            {isHidden ? (
              <PanelLeft size={18} className="text-text-secondary" />
            ) : (
              <Menu size={18} className="text-text-secondary" />
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-phosphor-teal">
              {boardId}
            </span>
            <span className="text-text-tertiary">|</span>
            <span className="font-mono text-xs text-text-secondary">
              {batchId}
            </span>
          </div>
          
          {/* View-only badge for non-operators */}
          {!isOperator && (
            <div className="flex items-center gap-2 px-3 py-1 bg-phosphor-cyan/10 border border-phosphor-cyan/50">
              <Eye size={14} className="text-phosphor-cyan" />
              <span className="font-mono text-xs font-bold text-phosphor-cyan">{t('hmi.viewOnly')}</span>
            </div>
          )}
        </div>

        {/* Center: Status */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-1.5 border",
            statusConfig.color === 'phosphor-green' && "border-phosphor-green/50 bg-phosphor-green/10",
            statusConfig.color === 'phosphor-teal' && "border-phosphor-teal/50 bg-phosphor-teal/10",
            statusConfig.color === 'phosphor-red' && "border-phosphor-red/50 bg-phosphor-red/10",
            statusConfig.color === 'phosphor-cyan' && "border-phosphor-cyan/50 bg-phosphor-cyan/10",
          )}>
            <div className={cn(
              "w-2 h-2",
              statusConfig.color === 'phosphor-green' && "bg-phosphor-green",
              statusConfig.color === 'phosphor-teal' && "bg-phosphor-teal",
              statusConfig.color === 'phosphor-red' && "bg-phosphor-red",
              statusConfig.color === 'phosphor-cyan' && "bg-phosphor-cyan",
              connected && !isPaused && "animate-pulse"
            )} />
            <StatusIcon size={14} className={cn(
              statusConfig.color === 'phosphor-green' && "text-phosphor-green",
              statusConfig.color === 'phosphor-teal' && "text-phosphor-teal",
              statusConfig.color === 'phosphor-red' && "text-phosphor-red",
              statusConfig.color === 'phosphor-cyan' && "text-phosphor-cyan",
            )} />
            <span className={cn(
              "font-display text-xs font-bold tracking-widest",
              statusConfig.color === 'phosphor-green' && "text-phosphor-green",
              statusConfig.color === 'phosphor-teal' && "text-phosphor-teal",
              statusConfig.color === 'phosphor-red' && "text-phosphor-red",
              statusConfig.color === 'phosphor-cyan' && "text-phosphor-cyan",
            )}>
              {statusConfig.label}
            </span>
          </div>
          <span className="font-mono text-sm text-phosphor-teal">{currentTime}</span>
        </div>

        {/* Right: System icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 border border-surface-border bg-terminal hover:border-phosphor-teal transition-colors">
            <Settings size={16} className="text-text-tertiary" />
          </button>
          <button className="p-2 border border-surface-border bg-terminal hover:border-phosphor-teal transition-colors">
            <Sun size={16} className="text-text-tertiary" />
          </button>
          {error && (
            <div className="flex items-center gap-2 px-3 py-1 bg-phosphor-red/10 border border-phosphor-red/50">
              <AlertTriangle size={14} className="text-phosphor-red" />
              <span className="font-display text-xs font-bold text-phosphor-red">LINE</span>
            </div>
          )}
          <button className="p-2 border border-surface-border bg-terminal hover:border-phosphor-teal transition-colors">
            <HelpCircle size={16} className="text-text-tertiary" />
          </button>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: AI Detection + Actions */}
        <div className="w-[340px] shrink-0 border-r border-surface-border bg-panel flex flex-col">
          {/* AI Detection Card */}
          <div className="p-4 border-b border-surface-border">
            <div className="panel-header mb-3">
              <Eye className="w-4 h-4" />
              <span>{t('manager.aiDetection')}</span>
            </div>

            {/* Defect Type */}
            <div className="bg-terminal border border-surface-border p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "w-3 h-3",
                  defectType === 'PASS' || defectType === 'SCANNING...' ? 'bg-text-tertiary' : 'bg-phosphor-red'
                )} />
                <span className={cn(
                  "font-display text-lg font-bold tracking-wide",
                  defectType === 'PASS' ? 'text-phosphor-green' :
                  defectType === 'SCANNING...' ? 'text-text-tertiary' :
                  'text-phosphor-red'
                )}>
                  {defectType.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              {/* Confidence */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-text-tertiary">{t('inspection.confidence')}</span>
                  <span className={cn(
                    "font-mono text-2xl font-bold",
                    confidence >= 85 ? 'text-phosphor-green' :
                    confidence >= 60 ? 'text-phosphor-teal' :
                    'text-phosphor-red'
                  )}>
                    {confidence}%
                  </span>
                </div>
                <div className="h-2 bg-void border border-surface-border">
                  <div
                    className={cn(
                      "h-full transition-all",
                      confidence >= 85 ? 'bg-phosphor-green' :
                      confidence >= 60 ? 'bg-phosphor-teal' :
                      'bg-phosphor-red'
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>

              <span className="font-mono text-xxs text-text-tertiary">
                {t('inspection.historicallyCorrect')} {historicalAccuracy}{t('inspection.ofTheTime')}
              </span>
            </div>

            {/* High Confidence Badge */}
            {confidence >= 85 && isOperator && (
              <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-green/10 border border-phosphor-green/30">
                <div className="w-2 h-2 bg-phosphor-green" />
                <span className="font-display text-xs font-semibold text-phosphor-green tracking-wide">
                  {t('inspection.highConfidence')}
                </span>
              </div>
            )}
          </div>

          {/* Auto-Approve Timer - only for operators */}
          <div className="p-4 border-b border-surface-border bg-terminal">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="data-label">
                  {isOperator ? t('inspection.autoApproveIn') : t('inspection.autoApprove')}
                </span>
                <p className="font-mono text-xs text-text-tertiary mt-0.5">
                  {isOperator ? t('inspection.takeActionOrWait') : t('inspection.disabledInViewMode')}
                </p>
              </div>
              <AutoApproveTimer
                duration={autoApproveDuration}
                isPaused={isPaused || !connected}
                confidence={confidence}
                confidenceThreshold={85}
                onTimeout={handleAutoApprove}
                size={80}
                disabled={!isOperator}
              />
            </div>

            {/* Warning when active - only for operators */}
            {isOperator && confidence >= 85 && !isPaused && connected && (
              <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-teal/10 border border-phosphor-teal/30 animate-pulse">
                <AlertTriangle size={14} className="text-phosphor-teal" />
                <span className="font-mono text-xs text-phosphor-teal">
                  {t('inspection.autoApprovingSoon')}
                </span>
              </div>
            )}
            
            {/* View-only message */}
            {!isOperator && (
              <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-cyan/10 border border-phosphor-cyan/30">
                <Eye size={14} className="text-phosphor-cyan" />
                <span className="font-mono text-xs text-phosphor-cyan">
                  {t('inspection.viewOnlyActive')}
                </span>
              </div>
            )}
          </div>

          {/* Operator Actions */}
          <div className="p-4 flex-1">
            <div className="panel-header mb-3">
              <Radio className="w-4 h-4" />
              <span>{t('inspection.operatorAction')}</span>
              {!isOperator && (
                <span className="ml-auto text-phosphor-cyan font-mono text-xxs">{t('inspection.disabled')}</span>
              )}
            </div>

            <div className="space-y-3">
              {/* APPROVE */}
              <button
                onClick={handleApprove}
                disabled={actionsDisabled}
                className={cn(
                  "w-full py-5 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-green/20 border-2 border-phosphor-green text-phosphor-green",
                  "hover:bg-phosphor-green hover:text-void",
                  "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-phosphor-green/20 disabled:hover:text-phosphor-green"
                )}
              >
                <Check size={28} strokeWidth={3} />
                <span className="font-display text-2xl font-bold tracking-wider">{t('inspection.approve')}</span>
              </button>

              {/* REJECT */}
              <button
                onClick={handleReject}
                disabled={actionsDisabled}
                className={cn(
                  "w-full py-5 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-red/20 border-2 border-phosphor-red text-phosphor-red",
                  "hover:bg-phosphor-red hover:text-white",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <X size={28} strokeWidth={3} />
                <span className="font-display text-2xl font-bold tracking-wider">{t('inspection.reject')}</span>
              </button>

              {/* FALSE CALL */}
              <button
                onClick={handleFalseCall}
                disabled={actionsDisabled}
                className={cn(
                  "w-full py-4 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-teal/10 border-2 border-phosphor-teal/50 text-phosphor-teal",
                  "hover:bg-phosphor-teal/20 hover:border-phosphor-teal",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <Flag size={20} />
                <span className="font-display text-lg font-bold tracking-wider">{t('inspection.falseCallBtn')}</span>
              </button>
            </div>

            {/* Keyboard shortcuts - only show for operators */}
            {isOperator ? (
              <div className="mt-4 flex items-center justify-center gap-4 text-text-tertiary">
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-void border border-surface-border font-mono text-xs">A</span>
                  <span className="font-mono text-xxs">{t('inspection.approve')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-void border border-surface-border font-mono text-xs">R</span>
                  <span className="font-mono text-xxs">{t('inspection.reject')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-void border border-surface-border font-mono text-xs">F</span>
                  <span className="font-mono text-xxs">{t('inspection.falseCallBtn')}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-phosphor-cyan/5 border border-phosphor-cyan/20">
                <p className="font-mono text-xs text-phosphor-cyan text-center">
                  {t('inspection.actionsDisabledFor')} {user?.role?.toUpperCase() || t('inspection.nonOperator')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Camera View */}
        <div className="flex-1 bg-void p-4 flex flex-col">
          {/* Camera Frame */}
          <div className="flex-1 border-2 border-surface-border relative overflow-hidden bg-terminal">
            {/* Camera Header */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-panel/95 border-b border-surface-border flex items-center justify-between px-4 z-10 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2.5 h-2.5",
                  isPaused ? "bg-phosphor-cyan" :
                  connected ? "bg-phosphor-red animate-pulse" :
                  "bg-text-tertiary"
                )} />
                <span className={cn(
                  "font-mono text-xs font-bold",
                  isPaused ? "text-phosphor-cyan" :
                  connected ? "text-phosphor-red" :
                  "text-text-tertiary"
                )}>
                  {isPaused ? t('inspection.paused') : connected ? t('inspection.rec') : t('inspection.offline')}
                </span>
                <span className="font-mono text-xs text-text-tertiary">CAM-01</span>
              </div>
              <div className="flex items-center gap-2">
                <Video size={14} className="text-phosphor-teal" />
                <span className="font-display text-xs font-semibold text-text-primary tracking-wider">
                  {t('inspection.liveCameraFeed')}
                </span>
              </div>
              <span className="font-mono text-xs text-text-tertiary">1920×1080 @ 30fps</span>
            </div>

            {/* Detection Legend */}
            <DetectionLegend detections={currentFrame?.detections || []} />

            {/* Detection Overlay */}
            <div className="absolute inset-0 top-10 flex items-center justify-center">
              {/* Paused Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-void/80 z-20 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="w-24 h-24 border-2 border-phosphor-cyan flex items-center justify-center mb-4 mx-auto bg-phosphor-cyan/10">
                      <Pause size={48} className="text-phosphor-cyan" />
                    </div>
                    <p className="font-display text-2xl font-bold text-phosphor-cyan tracking-wider">
                      {t('inspection.inspectionPaused')}
                    </p>
                    <p className="font-mono text-sm text-text-tertiary mt-2">
                      {t('inspection.pressSpaceResume')}
                    </p>
                  </div>
                </div>
              )}

              <div className="relative w-[90%] h-[90%]">
                <DetectionOverlay
                  imageUrl={currentFrame?.image_url}
                  detections={currentFrame?.detections || []}
                  result={currentFrame?.result}
                  width="100%"
                  height="100%"
                />
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
              <button
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-teal transition-colors backdrop-blur"
              >
                <ZoomIn size={20} className="text-text-primary" />
              </button>
              <button
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-teal transition-colors backdrop-blur"
              >
                <ZoomOut size={20} className="text-text-primary" />
              </button>
              <button className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-teal transition-colors backdrop-blur">
                <Move size={20} className="text-text-primary" />
              </button>
              <div className="px-3 py-2 bg-panel/90 border border-surface-border text-center backdrop-blur">
                <span className="font-mono text-sm text-phosphor-teal">{zoomLevel}%</span>
              </div>
            </div>

            {/* Technical corners */}
            <div className="absolute top-12 left-2 w-8 h-8 border-l-2 border-t-2 border-phosphor-teal/30" />
            <div className="absolute top-12 right-2 w-8 h-8 border-r-2 border-t-2 border-phosphor-teal/30" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-phosphor-teal/30" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-phosphor-teal/30" />
          </div>
        </div>
      </main>

      {/* === FOOTER BAR === */}
      <footer className="h-16 bg-panel border-t border-surface-border flex items-center justify-between px-4 shrink-0">
        {/* Left: EXIT + PAUSE */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleStop}
            className={cn(
              "h-12 px-6 font-display text-lg font-bold tracking-wider flex items-center gap-2 transition-all",
              isOperator 
                ? "bg-phosphor-red text-white hover:shadow-glow-red"
                : "bg-phosphor-cyan text-void hover:shadow-glow-cyan"
            )}
          >
            <Square size={16} fill="currentColor" />
            {isOperator ? t('inspection.stop') : t('inspection.exit')}
          </button>

          <button
            onClick={togglePause}
            className={cn(
              "h-12 px-6 font-display text-lg font-bold tracking-wider flex items-center gap-2 transition-all",
              isPaused
                ? "bg-phosphor-green text-void hover:shadow-glow-green"
                : "bg-phosphor-cyan/20 border-2 border-phosphor-cyan text-phosphor-cyan hover:bg-phosphor-cyan/30"
            )}
          >
            {isPaused ? (
              <>
                <Play size={20} />
                {t('inspection.resume')}
              </>
            ) : (
              <>
                <Pause size={20} />
                {t('inspection.pause')}
              </>
            )}
          </button>
        </div>

        {/* Center: Navigation - only for operators */}
        <div className="flex items-center gap-3">
          <button
            disabled={!isOperator || isPaused}
            className="h-12 px-6 bg-terminal border border-surface-border text-text-secondary font-display font-bold tracking-wider flex items-center gap-2 hover:border-phosphor-teal hover:text-phosphor-teal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
            {t('inspection.prev')}
          </button>
          <button
            disabled={!isOperator || isPaused}
            className="h-12 px-8 bg-phosphor-teal text-void font-display text-lg font-bold tracking-wider flex items-center gap-2 hover:shadow-glow-teal transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('inspection.next')}
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-phosphor-green" />
            <span className="font-mono text-xl font-bold text-phosphor-green">{stats.pass}</span>
          </div>
          <div className="flex items-center gap-2">
            <X size={18} className="text-phosphor-red" />
            <span className="font-mono text-xl font-bold text-phosphor-red">{stats.fail}</span>
          </div>
          <div className="h-8 w-px bg-surface-border" />
          <div className="px-4 py-2 bg-phosphor-teal/10 border border-phosphor-teal/30">
            <span className="font-mono text-xl font-bold text-phosphor-teal">{yieldRate}%</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-terminal border border-surface-border hover:border-phosphor-teal transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 size={20} className="text-text-primary" />
            ) : (
              <Maximize2 size={20} className="text-text-primary" />
            )}
          </button>
        </div>
      </footer>

      {/* False Call Modal - only for operators */}
      {showFalseCallModal && isOperator && (
        <FalseCallOverrideModal
          isOpen={showFalseCallModal}
          onClose={() => setShowFalseCallModal(false)}
          boardId={boardId}
          imageUrl={currentFrame?.image_url}
          aiDetections={currentFrame?.detections}
          sectionId={sectionId}
          lineId={lineId}
          customerId={customerId}
          user={user}
          onSuccess={() => setShowFalseCallModal(false)}
        />
      )}
    </div>
  );
}

export default LiveView;

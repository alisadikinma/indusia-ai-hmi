'use client';

/**
 * HMI Operator View Component
 * Control Room Brutalism Design
 * Full-screen focused inspection interface for operators
 * Mission-critical aesthetic with phosphor colors
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Menu, HelpCircle, AlertTriangle, Video,
  ZoomIn, ZoomOut, Move, Maximize2, Minimize2,
  Check, X, Pause, Play, Radio, Activity, Eye,
  ChevronLeft, ChevronRight, Flag
} from 'lucide-react';
import { useHMILayout } from '@/hooks/useHMILayout';
import { useLiveInspection } from '@/hooks/useLiveInspection';
import { HMIActionPanel } from './HMIActionPanel';
import { DetectionOverlay } from './DetectionOverlay';
import FalseCallOverrideModal from './FalseCallOverrideModal';
import { cn } from '@/lib/utils';

export function HMIOperatorView({
  lineId,
  lineName,
  sectionId,
  customerId,
  boardId,
  user,
  onExit,
}) {
  // Layout hook
  const {
    layout,
    isPaused,
    togglePause,
    toggleFullscreen,
  } = useHMILayout();

  // Local state
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFalseCallModal, setShowFalseCallModal] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Live inspection hook
  const {
    connected,
    connecting,
    currentFrame,
    stats,
    error,
    disconnect,
  } = useLiveInspection(lineId);

  // Extract detection data
  const detection = currentFrame?.detections?.[0] || {};
  const defectType = detection.class_name || 'SCANNING...';
  const confidence = Math.round((detection.confidence || 0) * 100);
  const boardIdDisplay = currentFrame?.board_id || boardId || 'N/A';

  // Calculate yield rate
  const totalInspected = stats.pass + stats.fail + stats.review;
  const yieldRate = totalInspected > 0
    ? ((stats.pass / totalInspected) * 100).toFixed(1)
    : '0.0';

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

  // Action handlers
  const handleApprove = useCallback(() => {
    console.log('Approved:', boardIdDisplay);
  }, [boardIdDisplay]);

  const handleReject = useCallback(() => {
    console.log('Rejected:', boardIdDisplay);
  }, [boardIdDisplay]);

  const handleFalseCall = useCallback(() => {
    setShowFalseCallModal(true);
  }, []);

  const handleAutoApprove = useCallback(() => {
    console.log('Auto-approved:', boardIdDisplay);
    handleApprove();
  }, [boardIdDisplay, handleApprove]);

  const handleStop = useCallback(() => {
    disconnect();
    if (onExit) onExit();
  }, [disconnect, onExit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFalseCallModal) return;

      switch (e.key.toLowerCase()) {
        case 'a':
          if (!isPaused) handleApprove();
          break;
        case 'r':
          if (!isPaused) handleReject();
          break;
        case 'f':
          if (!isPaused) handleFalseCall();
          break;
        case ' ':
          e.preventDefault();
          togglePause();
          break;
        case 'escape':
          if (layout.fullscreen) toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, showFalseCallModal, handleApprove, handleReject, handleFalseCall, togglePause, toggleFullscreen, layout.fullscreen]);

  // Status configuration
  const getStatusConfig = () => {
    if (isPaused) return { color: 'phosphor-cyan', label: 'PAUSED', icon: Pause };
    if (connected) return { color: 'phosphor-green', label: 'INSPECTING', icon: Activity };
    if (connecting) return { color: 'phosphor-amber', label: 'CONNECTING', icon: Radio };
    return { color: 'phosphor-red', label: 'OFFLINE', icon: AlertTriangle };
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="min-h-screen bg-void flex flex-col font-sans">
      {/* === HEADER BAR === */}
      <header className="h-12 bg-panel border-b border-surface-border flex items-center justify-between px-4 shrink-0">
        {/* Left: Exit + Board Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="p-2 border border-surface-border bg-terminal hover:border-phosphor-amber hover:text-phosphor-amber transition-colors"
          >
            <Menu size={18} className="text-text-secondary" />
          </button>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-terminal border border-phosphor-amber/50">
              <span className="font-mono text-sm font-bold text-phosphor-amber">
                {boardIdDisplay}
              </span>
            </div>
            <div className="h-4 w-px bg-surface-border" />
            <span className="font-mono text-xs text-text-tertiary">
              {lineName || lineId}
            </span>
          </div>
        </div>

        {/* Center: Status */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-1.5 border",
            `border-${statusConfig.color}/50 bg-${statusConfig.color}/10`
          )}>
            <div className={cn(
              "w-2 h-2",
              `bg-${statusConfig.color}`,
              !isPaused && connected && "animate-pulse"
            )} />
            <statusConfig.icon size={14} className={`text-${statusConfig.color}`} />
            <span className={cn(
              "font-display text-xs font-bold tracking-widest",
              `text-${statusConfig.color}`
            )}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Right: Time + Help */}
        <div className="flex items-center gap-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-1 bg-phosphor-red/10 border border-phosphor-red/50">
              <AlertTriangle size={14} className="text-phosphor-red" />
              <span className="font-mono text-xs text-phosphor-red">ALERT</span>
            </div>
          )}
          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>
          <button className="p-2 border border-surface-border bg-terminal hover:border-phosphor-amber transition-colors">
            <HelpCircle size={16} className="text-text-tertiary" />
          </button>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT: Action Panel */}
        <div className="w-[360px] shrink-0 border-r border-surface-border bg-panel flex flex-col">
          {/* Detection Info */}
          <div className="p-4 border-b border-surface-border">
            <div className="panel-header mb-3">
              <Eye className="w-4 h-4" />
              <span>Detection Analysis</span>
            </div>

            <div className="space-y-3">
              {/* Defect Type */}
              <div className="bg-terminal border border-surface-border p-3">
                <span className="data-label">DETECTED CLASS</span>
                <p className={cn(
                  "font-mono text-xl font-bold mt-1",
                  defectType === 'PASS' ? 'text-phosphor-green' :
                  defectType === 'SCANNING...' ? 'text-text-tertiary' :
                  'text-phosphor-red'
                )}>
                  {defectType}
                </p>
              </div>

              {/* Confidence */}
              <div className="bg-terminal border border-surface-border p-3">
                <span className="data-label">CONFIDENCE SCORE</span>
                <div className="flex items-end gap-2 mt-1">
                  <span className="font-mono text-3xl font-bold text-phosphor-amber">
                    {confidence}
                  </span>
                  <span className="font-mono text-sm text-text-tertiary mb-1">%</span>
                </div>
                <div className="mt-2 h-2 bg-void border border-surface-border">
                  <div
                    className={cn(
                      "h-full transition-all",
                      confidence >= 90 ? 'bg-phosphor-green' :
                      confidence >= 70 ? 'bg-phosphor-amber' :
                      'bg-phosphor-red'
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 flex-1">
            <div className="panel-header mb-3">
              <Radio className="w-4 h-4" />
              <span>Operator Actions</span>
            </div>

            <div className="space-y-3">
              {/* APPROVE */}
              <button
                onClick={handleApprove}
                disabled={isPaused || !connected}
                className={cn(
                  "w-full py-5 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-green/20 border-2 border-phosphor-green text-phosphor-green",
                  "hover:bg-phosphor-green hover:text-void",
                  "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-phosphor-green/20 disabled:hover:text-phosphor-green"
                )}
              >
                <Check size={28} strokeWidth={3} />
                <span className="font-display text-2xl font-bold tracking-wider">APPROVE</span>
                <span className="font-mono text-xs opacity-60">[A]</span>
              </button>

              {/* REJECT */}
              <button
                onClick={handleReject}
                disabled={isPaused || !connected}
                className={cn(
                  "w-full py-5 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-red/20 border-2 border-phosphor-red text-phosphor-red",
                  "hover:bg-phosphor-red hover:text-white",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <X size={28} strokeWidth={3} />
                <span className="font-display text-2xl font-bold tracking-wider">REJECT</span>
                <span className="font-mono text-xs opacity-60">[R]</span>
              </button>

              {/* FALSE CALL */}
              <button
                onClick={handleFalseCall}
                disabled={isPaused || !connected}
                className={cn(
                  "w-full py-4 flex items-center justify-center gap-3 transition-all",
                  "bg-phosphor-amber/10 border-2 border-phosphor-amber/50 text-phosphor-amber",
                  "hover:bg-phosphor-amber/20 hover:border-phosphor-amber",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <Flag size={20} />
                <span className="font-display text-lg font-bold tracking-wider">FALSE CALL</span>
                <span className="font-mono text-xs opacity-60">[F]</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-surface-border bg-terminal">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <span className="data-label">PASSED</span>
                <p className="font-mono text-2xl font-bold text-phosphor-green">{stats.pass}</p>
              </div>
              <div className="text-center">
                <span className="data-label">FAILED</span>
                <p className="font-mono text-2xl font-bold text-phosphor-red">{stats.fail}</p>
              </div>
              <div className="text-center">
                <span className="data-label">YIELD</span>
                <p className="font-mono text-2xl font-bold text-phosphor-amber">{yieldRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Camera View */}
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
                  {isPaused ? 'PAUSED' : connected ? 'REC' : 'OFFLINE'}
                </span>
                <span className="font-mono text-xs text-text-tertiary">CAM-01</span>
              </div>
              <div className="flex items-center gap-2">
                <Video size={14} className="text-phosphor-amber" />
                <span className="font-display text-xs font-semibold text-text-primary tracking-wider">
                  LIVE FEED
                </span>
              </div>
              <span className="font-mono text-xs text-text-tertiary">1920x1080 @ 30fps</span>
            </div>

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
                      INSPECTION PAUSED
                    </p>
                    <p className="font-mono text-sm text-text-tertiary mt-2">
                      PRESS [SPACE] TO RESUME
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
                className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-amber transition-colors backdrop-blur"
              >
                <ZoomIn size={20} className="text-text-primary" />
              </button>
              <button
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-amber transition-colors backdrop-blur"
              >
                <ZoomOut size={20} className="text-text-primary" />
              </button>
              <button className="p-3 bg-panel/90 border border-surface-border hover:border-phosphor-amber transition-colors backdrop-blur">
                <Move size={20} className="text-text-primary" />
              </button>
              <div className="px-3 py-2 bg-panel/90 border border-surface-border text-center backdrop-blur">
                <span className="font-mono text-sm text-phosphor-amber">{zoomLevel}%</span>
              </div>
            </div>

            {/* Technical corners */}
            <div className="absolute top-12 left-2 w-8 h-8 border-l-2 border-t-2 border-phosphor-amber/30" />
            <div className="absolute top-12 right-2 w-8 h-8 border-r-2 border-t-2 border-phosphor-amber/30" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-phosphor-amber/30" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-phosphor-amber/30" />
          </div>
        </div>
      </main>

      {/* === FOOTER BAR === */}
      <footer className="h-16 bg-panel border-t border-surface-border flex items-center justify-between px-4 shrink-0">
        {/* Left: STOP + PAUSE */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleStop}
            className="h-12 px-6 bg-phosphor-red text-white font-display text-lg font-bold tracking-wider flex items-center gap-2 hover:shadow-glow-red transition-all"
          >
            <div className="w-3 h-3 bg-white" />
            STOP
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
                RESUME
              </>
            ) : (
              <>
                <Pause size={20} />
                PAUSE
              </>
            )}
          </button>
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center gap-3">
          <button
            disabled={isPaused}
            className="h-12 px-6 bg-terminal border border-surface-border text-text-secondary font-display font-bold tracking-wider flex items-center gap-2 hover:border-phosphor-amber hover:text-phosphor-amber transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={20} />
            PREV
          </button>
          <button
            disabled={isPaused}
            className="h-12 px-8 bg-phosphor-amber text-void font-display text-lg font-bold tracking-wider flex items-center gap-2 hover:shadow-glow-amber transition-all disabled:opacity-30"
          >
            NEXT
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Right: Fullscreen */}
        <div className="flex items-center gap-4">
          {/* Quick stats */}
          <div className="flex items-center gap-4 mr-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-phosphor-green/50 bg-phosphor-green/10 flex items-center justify-center">
                <Check size={14} className="text-phosphor-green" />
              </div>
              <span className="font-mono text-xl font-bold text-phosphor-green">{stats.pass}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-phosphor-red/50 bg-phosphor-red/10 flex items-center justify-center">
                <X size={14} className="text-phosphor-red" />
              </div>
              <span className="font-mono text-xl font-bold text-phosphor-red">{stats.fail}</span>
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 bg-terminal border border-surface-border hover:border-phosphor-amber transition-colors"
          >
            {layout.fullscreen ? (
              <Minimize2 size={20} className="text-text-primary" />
            ) : (
              <Maximize2 size={20} className="text-text-primary" />
            )}
          </button>
        </div>
      </footer>

      {/* False Call Modal */}
      {showFalseCallModal && (
        <FalseCallOverrideModal
          isOpen={showFalseCallModal}
          onClose={() => setShowFalseCallModal(false)}
          boardId={boardIdDisplay}
          imageUrl={currentFrame?.image_url}
          aiDetections={currentFrame?.detections}
          sectionId={sectionId}
          lineId={lineId}
          customerId={customerId}
          user={user}
          onSuccess={() => {
            setShowFalseCallModal(false);
          }}
        />
      )}
    </div>
  );
}

export default HMIOperatorView;

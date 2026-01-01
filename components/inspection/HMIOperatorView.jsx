'use client';

/**
 * HMI Operator View Component
 * Full-screen focused inspection interface for operators
 * ISA-101 compliant, minimal distractions, large touch targets
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Menu, HelpCircle, AlertTriangle, Sun, Moon, Video,
  ZoomIn, ZoomOut, Move, Maximize2, Minimize2,
  Check, X, Pause, Play
} from 'lucide-react';
import { useHMILayout } from '@/hooks/useHMILayout';
import { useLiveInspection } from '@/hooks/useLiveInspection';
import { HMIActionPanel } from './HMIActionPanel';
import { DetectionOverlay } from './DetectionOverlay';
import { FalseCallOverrideModal } from './FalseCallOverrideModal';
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
    isDarkMode,
    themeColors,
    toggleTheme,
    togglePause,
    toggleFullscreen,
  } = useHMILayout();

  // Local state
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFalseCallModal, setShowFalseCallModal] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const timerRef = useRef(null);

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

  // Extract detection data from current frame
  const detection = currentFrame?.detections?.[0] || {};
  const defectType = detection.class_name || 'SCANNING...';
  const confidence = Math.round((detection.confidence || 0) * 100);
  const boardIdDisplay = currentFrame?.board_id || boardId || 'N/A';

  // Calculate yield rate
  const totalInspected = stats.pass + stats.fail + stats.review;
  const yieldRate = totalInspected > 0 
    ? ((stats.pass / totalInspected) * 100).toFixed(1)
    : '0.0';

  // Get current timestamp
  const [currentTime, setCurrentTime] = useState('');
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
    // TODO: Call API to record approval
    // Reset timer would happen automatically via onTimeout reset
  }, [boardIdDisplay]);

  const handleReject = useCallback(() => {
    console.log('Rejected:', boardIdDisplay);
    // TODO: Call API to record rejection
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
        case ' ': // Spacebar
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

  const colors = themeColors;

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors duration-300"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {/* === COMPACT HEADER === */}
      <header 
        className="h-11 flex items-center justify-between px-4 shrink-0 border-b transition-colors"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        {/* Left: Menu + Board Info */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onExit}
            className="p-1.5 rounded transition-colors hover:opacity-80"
          >
            <Menu size={18} style={{ color: colors.textMuted }} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono font-semibold" style={{ color: colors.primary }}>
              {boardIdDisplay}
            </span>
            <span style={{ color: colors.textMuted }}>|</span>
            <span className="text-xs" style={{ color: colors.textMuted }}>
              {lineName || lineId}
            </span>
          </div>
        </div>

        {/* Center: Status */}
        <div className="flex items-center gap-4">
          {isPaused && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/50 animate-pulse">
              <Pause size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">PAUSED</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isPaused ? "bg-blue-400" : 
              connected ? "bg-emerald-400 animate-pulse" : 
              connecting ? "bg-yellow-400 animate-pulse" : "bg-red-400"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isPaused ? "text-blue-400" : 
              connected ? "text-emerald-400" : 
              connecting ? "text-yellow-400" : "text-red-400"
            )}>
              {isPaused ? 'PAUSED' : connected ? 'INSPECTING' : connecting ? 'CONNECTING' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
            {currentTime}
          </span>
        </div>

        {/* Right: Theme + Warning + Help */}
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all"
            style={{ 
              backgroundColor: isDarkMode ? '#2D3E56' : '#E0E0E0',
              border: `1px solid ${colors.border}`
            }}
          >
            <Sun size={14} className={isDarkMode ? 'text-gray-500' : 'text-amber-500'} />
            <div 
              className="w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? colors.primary : '#FCD34D' }}
            >
              {isDarkMode ? <Moon size={12} className="text-white" /> : <Sun size={12} className="text-amber-700" />}
            </div>
            <Moon size={14} className={isDarkMode ? 'text-blue-400' : 'text-gray-400'} />
          </button>

          {error && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/50">
              <AlertTriangle size={12} className="text-yellow-400" />
              <span className="text-xs text-yellow-400">Warning</span>
            </div>
          )}
          
          <button className="p-1.5 rounded transition-colors hover:opacity-80">
            <HelpCircle size={16} style={{ color: colors.textMuted }} />
          </button>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Action Panel (340px) */}
        <div 
          className="w-[340px] shrink-0 border-r transition-colors"
          style={{ borderColor: colors.border }}
        >
          <HMIActionPanel
            defectType={defectType}
            confidence={confidence}
            historicalAccuracy={94}
            autoApproveEnabled={layout.autoApproveEnabled}
            autoApproveTimeout={layout.autoApproveTimeout}
            isPaused={isPaused}
            onApprove={handleApprove}
            onReject={handleReject}
            onFalseCall={handleFalseCall}
            onTimeout={handleAutoApprove}
            theme={isDarkMode ? 'dark' : 'light'}
            themeColors={colors}
            disabled={!connected}
          />
        </div>

        {/* RIGHT: Camera View */}
        <div 
          className="flex-1 p-4 transition-colors"
          style={{ backgroundColor: isDarkMode ? '#0D1B2A' : '#E8E8E8' }}
        >
          <div 
            className="relative w-full h-full rounded-2xl border-2 overflow-hidden transition-colors"
            style={{ 
              borderColor: colors.border,
              backgroundColor: isDarkMode ? '#0A0F18' : '#E0E0E0'
            }}
          >
            {/* Camera Header */}
            <div 
              className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 border-b z-10"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(26, 41, 66, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: colors.border,
                backdropFilter: 'blur(8px)'
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    isPaused ? "bg-blue-500" : connected ? "bg-red-500 animate-pulse" : "bg-gray-500"
                  )} />
                  <span className={cn(
                    "text-xs font-semibold",
                    isPaused ? "text-blue-400" : connected ? "text-red-400" : "text-gray-400"
                  )}>
                    {isPaused ? '⏸ PAUSED' : connected ? '● REC' : '○ OFFLINE'}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: colors.textMuted }}>CAM-01</span>
              </div>
              <div className="flex items-center gap-3">
                <Video size={16} style={{ color: colors.primary }} />
                <span className="text-xs font-medium" style={{ color: colors.text }}>LIVE CAMERA FEED</span>
              </div>
              <span className="text-xs font-mono" style={{ color: colors.textMuted }}>1920×1080 @ 30fps</span>
            </div>

            {/* Camera View with Detection Overlay */}
            <div className="absolute inset-0 top-10 flex items-center justify-center">
              {/* Paused Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center mb-4 mx-auto">
                      <Pause size={40} className="text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-blue-400">INSPECTION PAUSED</p>
                    <p className="text-sm text-gray-400 mt-2">Press SPACE or RESUME to continue</p>
                  </div>
                </div>
              )}

              {/* Detection Overlay */}
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
                className="p-3 rounded-xl transition-colors border backdrop-blur"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(26, 41, 66, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: colors.border
                }}
              >
                <ZoomIn size={22} style={{ color: colors.text }} />
              </button>
              <button 
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                className="p-3 rounded-xl transition-colors border backdrop-blur"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(26, 41, 66, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: colors.border
                }}
              >
                <ZoomOut size={22} style={{ color: colors.text }} />
              </button>
              <button 
                className="p-3 rounded-xl transition-colors border backdrop-blur"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(26, 41, 66, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: colors.border
                }}
              >
                <Move size={22} style={{ color: colors.text }} />
              </button>
              <div 
                className="px-3 py-2 rounded-xl text-center border backdrop-blur"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(26, 41, 66, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: colors.border
                }}
              >
                <span className="text-sm font-mono" style={{ color: colors.primary }}>{zoomLevel}%</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* === FOOTER === */}
      <footer 
        className="h-[60px] flex items-center justify-between px-4 shrink-0 border-t transition-colors"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        {/* STOP + PAUSE */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleStop}
            className="h-12 px-5 bg-red-700 hover:bg-red-600 active:bg-red-800 rounded-xl flex items-center gap-2 font-bold text-lg transition-colors shadow-lg text-white"
          >
            <div className="w-3 h-3 bg-white rounded-full" />
            STOP
          </button>
          
          <button 
            onClick={togglePause}
            className={cn(
              "h-12 px-5 rounded-xl flex items-center gap-2 font-bold text-lg transition-colors shadow-lg text-white",
              isPaused 
                ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700' 
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
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

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button 
            disabled={isPaused}
            className={cn(
              "h-12 px-6 rounded-xl flex items-center gap-2 font-semibold transition-colors",
              isPaused && "opacity-50 cursor-not-allowed"
            )}
            style={{ backgroundColor: isDarkMode ? '#2D3E56' : '#D4D4D4', color: colors.text }}
          >
            <span className="text-xl">◀</span> PREV
          </button>
          <button 
            disabled={isPaused}
            className={cn(
              "h-12 px-8 rounded-xl flex items-center gap-2 font-bold text-lg transition-colors shadow-lg",
              isPaused && "opacity-50 cursor-not-allowed"
            )}
            style={{ backgroundColor: colors.primary, color: isDarkMode ? '#0A1628' : '#FFFFFF' }}
          >
            NEXT <span className="text-xl">▶</span>
          </button>
        </div>

        {/* Stats + Fullscreen */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={16} className="text-emerald-400" />
              </div>
              <span className="text-xl font-bold text-emerald-400">{stats.pass}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
                <X size={16} className="text-red-400" />
              </div>
              <span className="text-xl font-bold text-red-400">{stats.fail}</span>
            </div>
            <div 
              className="px-4 py-2 rounded-xl border"
              style={{ 
                backgroundColor: `${colors.primary}20`,
                borderColor: `${colors.primary}50`
              }}
            >
              <span className="text-xl font-bold" style={{ color: colors.primary }}>{yieldRate}%</span>
            </div>
          </div>

          <button 
            onClick={toggleFullscreen}
            className="p-3 rounded-xl transition-colors"
            style={{ backgroundColor: isDarkMode ? '#2D3E56' : '#D4D4D4' }}
          >
            {layout.fullscreen ? (
              <Minimize2 size={22} style={{ color: colors.text }} />
            ) : (
              <Maximize2 size={22} style={{ color: colors.text }} />
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
            // Move to next
          }}
        />
      )}
    </div>
  );
}

export default HMIOperatorView;

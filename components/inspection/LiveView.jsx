'use client'

/**
 * Live View Component
 * Main component for live inspection monitoring
 * Shows camera feed with detection overlay, stats, and detection log
 */

import { useState, useCallback } from 'react'
import { useLiveInspection } from '@/hooks/useLiveInspection'
import { DetectionOverlay } from './DetectionOverlay'
import { DetectionLog } from './DetectionLog'
import { OverrideModal } from '@/components/override/OverrideModal'
import { cn } from '@/lib/utils'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Settings
} from 'lucide-react'

export function LiveView({ lineId, lineName, sectionId, customerId, user }) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75)
  const [overrideTarget, setOverrideTarget] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const {
    connected,
    connecting,
    currentFrame,
    detectionLog,
    stats,
    error,
    connect,
    disconnect,
    clearLog,
    resetStats
  } = useLiveInspection(lineId, {
    onDetection: (data) => {
      // Play sound for defects if enabled
      if (soundEnabled && (data.result === 'fail' || data.result === 'review')) {
        playAlertSound()
      }
    }
  })

  const playAlertSound = () => {
    try {
      const audio = new Audio('/sounds/alert.mp3')
      audio.volume = 0.5
      audio.play().catch(() => { })
    } catch { }
  }

  const handleOverrideClick = useCallback((frame) => {
    setOverrideTarget({
      boardId: frame.board_id,
      imageUrl: frame.image_url,
      aiDetections: frame.detections
    })
  }, [])

  const handleOverrideSuccess = useCallback(() => {
    setOverrideTarget(null)
    // Could show toast notification here
  }, [])

  // Filter detections by confidence threshold
  const filteredDetections = currentFrame?.detections?.filter(
    d => (d.confidence || 0) >= confidenceThreshold
  ) || []

  // Calculate pass rate
  const totalInspected = stats.pass + stats.fail + stats.review
  const passRate = totalInspected > 0
    ? ((stats.pass / totalInspected) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="h-full flex flex-col bg-indusia-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indusia-border bg-indusia-surface">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-indusia-text">Live Inspection</h1>
            <p className="text-sm text-indusia-textMuted">{lineName || lineId}</p>
          </div>

          {/* Connection Status */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
              connected
                ? 'bg-indusia-pass/20 text-indusia-pass'
                : connecting
                  ? 'bg-indusia-warning/20 text-indusia-warning'
                  : 'bg-indusia-fail/20 text-indusia-fail'
            )}
          >
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <div className="w-2 h-2 rounded-full bg-indusia-pass animate-pulse" />
                LIVE
              </>
            ) : connecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                CONNECTING
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                DISCONNECTED
              </>
            )}
          </div>

          {!connected && !connecting && (
            <button
              onClick={connect}
              className="px-3 py-1 text-sm bg-indusia-primary text-white rounded hover:opacity-90"
            >
              Reconnect
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-indusia-pass">{stats.pass}</div>
            <div className="text-xs text-indusia-textMuted">Pass</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indusia-fail">{stats.fail}</div>
            <div className="text-xs text-indusia-textMuted">Fail</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indusia-warning">{stats.review}</div>
            <div className="text-xs text-indusia-textMuted">Review</div>
          </div>
          <div className="text-center border-l border-indusia-border pl-6">
            <div className="text-2xl font-bold text-indusia-primary">{passRate}%</div>
            <div className="text-xs text-indusia-textMuted">Pass Rate</div>
          </div>
          <button
            onClick={resetStats}
            className="p-2 text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted rounded transition-colors"
            title="Reset Stats"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Camera Feed + Overlay */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 relative flex items-center justify-center bg-indusia-surfaceMuted rounded-lg overflow-hidden">
            <DetectionOverlay
              imageUrl={currentFrame?.image_url}
              detections={filteredDetections}
              result={currentFrame?.result}
              onOverrideClick={() => currentFrame && handleOverrideClick(currentFrame)}
              width={800}
              height={600}
            />

            {error && !connected && (
              <div className="absolute bottom-4 left-4 right-4 bg-indusia-fail/90 text-white px-4 py-2 rounded-lg text-sm">
                {error.message}
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-3 text-sm">
            <div className="flex items-center gap-4 text-indusia-textMuted">
              <span>Board: <span className="text-indusia-text font-medium">{currentFrame?.board_id || '-'}</span></span>
              <span>Inference: <span className="text-indusia-text font-medium">{currentFrame?.inference_ms || 0}ms</span></span>
              <span>Detections: <span className="text-indusia-text font-medium">{filteredDetections.length}</span></span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  'p-2 rounded transition-colors',
                  soundEnabled
                    ? 'bg-indusia-primary/20 text-indusia-primary'
                    : 'text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted'
                )}
                title={soundEnabled ? 'Disable Sound Alerts' : 'Enable Sound Alerts'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Confidence Threshold Slider */}
              <div className="flex items-center gap-2 text-indusia-textMuted">
                <span className="text-xs">Confidence:</span>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-24 accent-indusia-primary"
                />
                <span className="w-10 text-xs text-indusia-text font-medium">
                  {Math.round(confidenceThreshold * 100)}%
                </span>
              </div>

              {/* Settings */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted rounded transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Detection Log Sidebar */}
        <div className="w-80 border-l border-indusia-border bg-indusia-surface flex flex-col">
          <div className="p-3 border-b border-indusia-border flex items-center justify-between">
            <h3 className="font-semibold text-indusia-text">Detection Log</h3>
            <button
              onClick={clearLog}
              className="p-1.5 text-indusia-textMuted hover:text-indusia-fail hover:bg-indusia-fail/10 rounded transition-colors"
              title="Clear Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DetectionLog
              items={detectionLog}
              onItemClick={handleOverrideClick}
              maxHeight="100%"
            />
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideTarget && (
        <OverrideModal
          isOpen={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          boardId={overrideTarget.boardId}
          imageUrl={overrideTarget.imageUrl}
          aiDetections={overrideTarget.aiDetections}
          sectionId={sectionId}
          lineId={lineId}
          customerId={customerId}
          user={user}
          onSuccess={handleOverrideSuccess}
        />
      )}
    </div>
  )
}

export default LiveView

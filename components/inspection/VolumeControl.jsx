'use client'

/**
 * VolumeControl Component
 * Compact volume slider with mute toggle for header bar
 */

import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Volume1 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VolumeControl({ 
  volume, 
  isMuted, 
  onVolumeChange, 
  onMuteToggle,
  onTest,
  className 
}) {
  const [showSlider, setShowSlider] = useState(false)
  const containerRef = useRef(null)

  // Close slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSlider(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get volume icon based on level
  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Volume Button */}
      <button
        onClick={() => setShowSlider(!showSlider)}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded border transition-colors",
          isMuted 
            ? "border-phosphor-red/50 text-phosphor-red" 
            : "border-surface-border text-text-secondary hover:text-text-primary hover:border-text-tertiary"
        )}
        title={isMuted ? "Unmute" : `Volume: ${volume}%`}
      >
        <VolumeIcon className="w-5 h-5" />
      </button>

      {/* Slider Popup */}
      {showSlider && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-panel border border-surface-border rounded shadow-lg z-50 min-w-[200px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs text-text-tertiary">VOLUME</span>
            <span className="font-mono text-xs text-text-primary">{volume}%</span>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onMuteToggle}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded transition-colors",
                isMuted 
                  ? "bg-phosphor-red/20 text-phosphor-red" 
                  : "bg-surface-border/50 text-text-secondary hover:text-text-primary"
              )}
            >
              <VolumeIcon className="w-4 h-4" />
            </button>
            
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              className={cn(
                "flex-1 h-2 rounded-full appearance-none cursor-pointer",
                "bg-surface-border",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                "[&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-phosphor-cyan",
                "[&::-webkit-slider-thumb]:cursor-pointer",
                "[&::-webkit-slider-thumb]:shadow-glow-cyan"
              )}
              style={{
                background: `linear-gradient(to right, #0FB5BA ${volume}%, #2D3E56 ${volume}%)`
              }}
            />
          </div>

          {/* Test Button */}
          <button
            onClick={() => {
              onTest?.()
              setShowSlider(false)
            }}
            className={cn(
              "w-full py-2 text-center font-mono text-xs transition-colors",
              "border border-surface-border text-text-secondary",
              "hover:border-phosphor-cyan hover:text-phosphor-cyan"
            )}
          >
            TEST AUDIO
          </button>
        </div>
      )}
    </div>
  )
}

export default VolumeControl

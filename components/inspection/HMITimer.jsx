'use client';

/**
 * HMI Timer Component
 * Circular countdown timer for auto-approve feature
 * ISA-101 compliant with color-coded urgency
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pause, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Get timer color based on seconds remaining
 * @param {number} seconds - Seconds remaining
 * @returns {string} - Hex color code
 */
function getTimerColor(seconds, total) {
  const ratio = seconds / total;
  if (ratio > 0.66) return '#10B981'; // Green - safe
  if (ratio > 0.33) return '#F59E0B'; // Yellow - warning
  return '#EF4444'; // Red - urgent
}

export function HMITimer({
  duration = 15,
  isPaused = false,
  onTimeout,
  onTick,
  autoReset = true,
  showWarning = true,
  warningThreshold = 5,
  size = 96,
  strokeWidth = 6,
}) {
  const { isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState(duration);

  // Calculate SVG properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / duration) * circumference;
  const timerColor = isPaused ? '#3B82F6' : getTimerColor(timeLeft, duration);

  // Theme-aware colors for SVG
  const bgColor = isDark ? '#2D3E56' : '#CBD5E1';
  const mutedColor = isDark ? '#8A95A8' : '#64748B';

  // Countdown effect
  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Callback on each tick
        if (onTick) onTick(newTime);

        if (newTime <= 0) {
          // Timeout reached
          if (onTimeout) onTimeout();
          
          // Auto-reset if enabled
          if (autoReset) {
            return duration;
          }
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, timeLeft, duration, onTimeout, onTick, autoReset]);

  // Reset timer when duration changes
  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  // Manual reset function
  const reset = useCallback(() => {
    setTimeLeft(duration);
  }, [duration]);

  const isWarning = !isPaused && timeLeft <= warningThreshold;

  return (
    <div className="flex flex-col items-center">
      {/* Circular Timer */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg 
          className="transform -rotate-90" 
          width={size} 
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={timerColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        
        {/* Timer text / Pause icon */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isPaused ? (
            <Pause size={size * 0.25} style={{ color: '#3B82F6' }} />
          ) : (
            <>
              <span 
                className="font-bold"
                style={{ 
                  color: timerColor, 
                  fontSize: size * 0.35,
                  lineHeight: 1 
                }}
              >
                {timeLeft}
              </span>
              <span 
                className="text-xs"
                style={{ color: mutedColor }}
              >
                sec
              </span>
            </>
          )}
        </div>
      </div>

      {/* Warning alert */}
      {showWarning && isWarning && (
        <div 
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg animate-pulse"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-sm font-medium text-red-400">
            Auto-approving soon!
          </span>
        </div>
      )}
    </div>
  );
}

// Export reset method for external control
HMITimer.displayName = 'HMITimer';

export default HMITimer;

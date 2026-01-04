'use client'

/**
 * InspectionStage Component
 * Shows loading/progress animation during inspection capture and processing
 * 
 * Stages:
 * 1. idle - Waiting for board
 * 2. unit_coming - Board detected
 * 3. camera_capture_top - Capturing TOP side
 * 4. ai_processing_top - AI processing TOP
 * 5. pcb_flipping - Flipping PCB
 * 6. camera_capture_bottom - Capturing BOTTOM side
 * 7. ai_processing_bottom - AI processing BOTTOM
 * 8. inspection_complete - Ready for review
 */

import { cn } from '@/lib/utils'
import { Loader2, Camera, Cpu, RotateCw, CheckCircle, Clock, Box } from 'lucide-react'

const STAGE_CONFIG = {
  'idle': { icon: Clock, color: 'text-text-tertiary', label: 'Idle', shortLabel: 'Idle' },
  'unit_coming': { icon: Box, color: 'text-phosphor-cyan', label: 'Board Incoming', shortLabel: 'Board' },
  'camera_capture_top': { icon: Camera, color: 'text-phosphor-cyan', label: 'Capture TOP', shortLabel: 'Cap TOP' },
  'ai_processing_top': { icon: Cpu, color: 'text-phosphor-amber', label: 'Process TOP', shortLabel: 'Proc TOP' },
  'pcb_flipping': { icon: RotateCw, color: 'text-phosphor-amber', label: 'Flipping', shortLabel: 'Flip' },
  'camera_capture_bottom': { icon: Camera, color: 'text-phosphor-cyan', label: 'Capture BOTTOM', shortLabel: 'Cap BOT' },
  'ai_processing_bottom': { icon: Cpu, color: 'text-phosphor-amber', label: 'Process BOTTOM', shortLabel: 'Proc BOT' },
  'inspection_complete': { icon: CheckCircle, color: 'text-phosphor-green', label: 'Complete', shortLabel: 'Done' }
}

const STAGE_ORDER = [
  'unit_coming',
  'camera_capture_top',
  'ai_processing_top',
  'pcb_flipping',
  'camera_capture_bottom',
  'ai_processing_bottom',
  'inspection_complete'
]

export function InspectionStage({ stage, className }) {
  const { status, stageName, message, stageIndex, totalStages } = stage

  // Idle state - waiting for board
  if (status === 'idle') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        className
      )}>
        {/* Animated waiting indicator */}
        <div className="relative mb-8">
          <div className="w-32 h-32 border-4 border-surface-border rounded-full flex items-center justify-center">
            <Clock className="w-16 h-16 text-text-tertiary animate-pulse" />
          </div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-phosphor-amber/30 rounded-full animate-ping" />
        </div>
        
        <p className="text-2xl text-text-secondary font-display font-bold tracking-wider mb-2">
          WAITING FOR BOARD
        </p>
        <p className="text-sm text-text-tertiary font-mono">
          System ready to receive next PCB
        </p>

        {/* Stage dots (all inactive) */}
        <div className="flex gap-3 mt-8">
          {STAGE_ORDER.map((key) => (
            <div
              key={key}
              className="w-3 h-3 rounded-full bg-surface-border"
              title={STAGE_CONFIG[key]?.label}
            />
          ))}
        </div>
      </div>
    )
  }

  const config = STAGE_CONFIG[stageName] || STAGE_CONFIG['idle']
  const Icon = config.icon
  const progress = (stageIndex / totalStages) * 100
  const isComplete = status === 'ready'

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full",
      className
    )}>
      {/* Stage Icon with animation */}
      <div className={cn(
        "relative mb-8",
        !isComplete && "animate-pulse"
      )}>
        <div className={cn(
          "w-32 h-32 border-4 rounded-full flex items-center justify-center transition-colors",
          isComplete 
            ? "border-phosphor-green/50 bg-phosphor-green/10" 
            : "border-phosphor-amber/50 bg-phosphor-amber/10"
        )}>
          <Icon className={cn(
            "w-16 h-16 transition-colors",
            config.color,
            !isComplete && (stageName === 'pcb_flipping' || stageName.includes('processing')) && "animate-spin"
          )} />
        </div>
        
        {/* Pulse ring */}
        {!isComplete && (
          <div className={cn(
            "absolute inset-0 w-32 h-32 border-4 rounded-full animate-ping",
            "border-phosphor-amber/30"
          )} />
        )}
      </div>

      {/* Message */}
      <p className={cn(
        "text-2xl font-display font-bold tracking-wider mb-4",
        isComplete ? "text-phosphor-green" : "text-text-primary"
      )}>
        {message}
      </p>

      {/* Progress Bar */}
      <div className="w-96 mb-4">
        <div className="h-2 bg-surface-border rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out rounded-full",
              isComplete ? "bg-phosphor-green" : "bg-phosphor-amber"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage Counter */}
      <p className="text-sm text-text-tertiary font-mono mb-6">
        Stage {stageIndex} of {totalStages}
      </p>

      {/* Stage Progress Dots with Alternating Labels */}
      <div className="flex items-center gap-2">
        {STAGE_ORDER.map((key, index) => {
          const stageNum = index + 1
          const isActive = stageNum === stageIndex
          const isPast = stageNum < stageIndex
          const stageConfig = STAGE_CONFIG[key]
          const labelOnTop = index % 2 === 0 // Alternate: even=top, odd=bottom
          
          return (
            <div
              key={key}
              className="flex flex-col items-center"
            >
              {/* Label on top (for even indices) */}
              {labelOnTop && (
                <span
                  className={cn(
                    "text-xxs font-mono mb-1 whitespace-nowrap",
                    isActive ? "text-phosphor-amber font-bold" : 
                    isPast ? "text-phosphor-green" : "text-text-tertiary"
                  )}
                >
                  {stageConfig?.shortLabel}
                </span>
              )}
              
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2",
                  isActive && "bg-phosphor-amber/20 border-phosphor-amber scale-110",
                  isPast && "bg-phosphor-green/20 border-phosphor-green",
                  !isActive && !isPast && "bg-terminal border-surface-border"
                )}
                title={stageConfig?.label}
              >
                {isPast ? (
                  <CheckCircle className="w-5 h-5 text-phosphor-green" />
                ) : (
                  <stageConfig.icon className={cn(
                    "w-5 h-5",
                    isActive ? stageConfig.color : "text-text-tertiary"
                  )} />
                )}
              </div>
              
              {/* Label on bottom (for odd indices) */}
              {!labelOnTop && (
                <span
                  className={cn(
                    "text-xxs font-mono mt-1 whitespace-nowrap",
                    isActive ? "text-phosphor-amber font-bold" : 
                    isPast ? "text-phosphor-green" : "text-text-tertiary"
                  )}
                >
                  {stageConfig?.shortLabel}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InspectionStage

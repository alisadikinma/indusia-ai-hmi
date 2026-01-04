'use client'

/**
 * InspectionStage Component
 * Shows loading/progress animation during inspection capture and processing
 * 
 * Stages (dev.py):
 * 1. start - Board incoming
 * 2. running - AI processing
 * 3. done - Ready for review
 */

import { cn } from '@/lib/utils'
import { Loader2, Camera, Cpu, CheckCircle, Clock, Box } from 'lucide-react'

const STAGE_CONFIG = {
  'idle': { icon: Clock, color: 'text-text-tertiary', label: 'Idle', shortLabel: 'Idle' },
  'start': { icon: Box, color: 'text-phosphor-cyan', label: 'Board Incoming', shortLabel: 'Board' },
  'running': { icon: Cpu, color: 'text-phosphor-amber', label: 'Processing', shortLabel: 'Process' },
  'done': { icon: CheckCircle, color: 'text-phosphor-green', label: 'Complete', shortLabel: 'Done' }
}

const STAGE_ORDER = ['start', 'running', 'done']

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
            !isComplete && stageName === 'running' && "animate-spin"
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

      {/* Stage Progress Dots */}
      <div className="flex items-center gap-6">
        {STAGE_ORDER.map((key, index) => {
          const stageNum = index + 1
          const isActive = stageNum === stageIndex
          const isPast = stageNum < stageIndex
          const stageConfig = STAGE_CONFIG[key]
          
          return (
            <div
              key={key}
              className="flex flex-col items-center"
            >
              {/* Label */}
              <span
                className={cn(
                  "text-xs font-mono mb-2 whitespace-nowrap",
                  isActive ? "text-phosphor-amber font-bold" : 
                  isPast ? "text-phosphor-green" : "text-text-tertiary"
                )}
              >
                {stageConfig?.shortLabel}
              </span>
              
              {/* Icon */}
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                  isActive && "bg-phosphor-amber/20 border-phosphor-amber scale-110",
                  isPast && "bg-phosphor-green/20 border-phosphor-green",
                  !isActive && !isPast && "bg-terminal border-surface-border"
                )}
                title={stageConfig?.label}
              >
                {isPast ? (
                  <CheckCircle className="w-6 h-6 text-phosphor-green" />
                ) : (
                  <stageConfig.icon className={cn(
                    "w-6 h-6",
                    isActive ? stageConfig.color : "text-text-tertiary",
                    isActive && stageName === 'running' && "animate-spin"
                  )} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InspectionStage

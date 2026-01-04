'use client'

/**
 * InspectionStage Component
 * Shows loading/progress animation during inspection capture and processing
 * 
 * Supports dynamic stages from /stages endpoint
 */

import { cn } from '@/lib/utils'
import { 
  Loader2, 
  Camera, 
  Cpu, 
  CheckCircle, 
  Clock, 
  Box, 
  Package, 
  RotateCcw,
  Circle
} from 'lucide-react'

// Icon mapping from backend icon names to lucide components
const ICON_MAP = {
  'box': Box,
  'cpu': Cpu,
  'check': CheckCircle,
  'clock': Clock,
  'camera': Camera,
  'loader': Loader2,
  'package': Package,
  'rotate': RotateCcw,
  'default': Circle
}

// Default fallback stages if none provided
const DEFAULT_STAGES = [
  { stage_id: 'stage-01', name: 'start', label: 'Board', icon: 'box' },
  { stage_id: 'stage-02', name: 'running', label: 'Process', icon: 'cpu' },
  { stage_id: 'stage-03', name: 'done', label: 'Done', icon: 'check' }
]

// Message mapping by stage name
const STAGE_MESSAGES = {
  'idle': 'Waiting for board...',
  'start': 'Board incoming...',
  'position_1': 'Camera Position 1...',
  'position_2': 'Camera Position 2...',
  'flip': 'Flipping PCB...',
  'position_3': 'Camera Position 3...',
  'position_4': 'Camera Position 4...',
  'running': 'Processing...',
  'done': 'Ready for review'
}

export function InspectionStage({ stage, stageDefinitions, className }) {
  const { status, stageName, message, stageIndex } = stage
  
  // Use provided stages or fallback - THIS IS THE SOURCE OF TRUTH
  const stages = stageDefinitions?.length > 0 ? stageDefinitions : DEFAULT_STAGES
  const actualTotalStages = stages.length // Use stages.length, NOT stage.totalStages
  const isCompact = stages.length > 5 // Compact mode for many stages

  // Get icon component from name
  const getIcon = (iconName) => ICON_MAP[iconName] || ICON_MAP['default']

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

        {/* Stage dots with labels (all inactive) */}
        <div className={cn("flex mt-8", isCompact ? "gap-3" : "gap-4")}>
          {stages.map((s) => {
            const StageIcon = getIcon(s.icon)
            return (
              <div key={s.stage_id} className="flex flex-col items-center">
                <div
                  className={cn(
                    "rounded-full bg-terminal border-2 border-surface-border flex items-center justify-center",
                    isCompact ? "w-8 h-8" : "w-10 h-10"
                  )}
                  title={s.label}
                >
                  <StageIcon className={cn(
                    "text-text-tertiary",
                    isCompact ? "w-4 h-4" : "w-5 h-5"
                  )} />
                </div>
                <span className={cn(
                  "font-mono text-text-tertiary mt-1",
                  isCompact ? "text-[9px]" : "text-xs"
                )}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Get current stage config from definitions
  const currentStageDef = stages.find(s => s.name === stageName)
  const CurrentIcon = getIcon(currentStageDef?.icon)
  
  // Calculate progress using actual stages length
  const progress = (stageIndex / actualTotalStages) * 100
  const isComplete = status === 'ready'
  const isProcessing = ['running', 'position_1', 'position_2', 'position_3', 'position_4'].includes(stageName)
  const isFlipping = stageName === 'flip'

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full",
      className
    )}>
      {/* Stage Icon with animation */}
      <div className={cn(
        "relative mb-6",
        !isComplete && "animate-pulse"
      )}>
        <div className={cn(
          "w-28 h-28 border-4 rounded-full flex items-center justify-center transition-colors",
          isComplete 
            ? "border-phosphor-green/50 bg-phosphor-green/10" 
            : "border-phosphor-amber/50 bg-phosphor-amber/10"
        )}>
          <CurrentIcon className={cn(
            "w-14 h-14 transition-colors",
            isComplete ? "text-phosphor-green" : "text-phosphor-amber",
            !isComplete && isProcessing && "animate-pulse",
            !isComplete && isFlipping && "animate-spin"
          )} />
        </div>
        
        {/* Pulse ring */}
        {!isComplete && (
          <div className={cn(
            "absolute inset-0 w-28 h-28 border-4 rounded-full animate-ping",
            "border-phosphor-amber/30"
          )} />
        )}
      </div>

      {/* Message + Stage Name */}
      <p className={cn(
        "text-2xl font-display font-bold tracking-wider mb-1",
        isComplete ? "text-phosphor-green" : "text-text-primary"
      )}>
        {message || STAGE_MESSAGES[stageName] || 'Processing...'}
      </p>
      
      {/* Current Stage Name */}
      <p className="text-sm text-text-tertiary font-mono mb-4">
        [{currentStageDef?.label || stageName}]
      </p>

      {/* Progress Bar */}
      <div className="w-96 mb-3">
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

      {/* Stage Counter - Use actualTotalStages */}
      <p className="text-sm text-text-tertiary font-mono mb-5">
        Stage {stageIndex} of {actualTotalStages}
      </p>

      {/* Stage Progress - Dynamic from /stages with labels */}
      <div className={cn("flex items-end", isCompact ? "gap-3" : "gap-4")}>
        {stages.map((s, index) => {
          const stageNum = index + 1
          const isActive = stageNum === stageIndex
          const isPast = stageNum < stageIndex
          const StageIcon = getIcon(s.icon)
          
          return (
            <div
              key={s.stage_id}
              className="flex flex-col items-center"
            >
              {/* Icon/Dot */}
              <div
                className={cn(
                  "rounded-full flex items-center justify-center transition-all border-2",
                  isCompact ? "w-8 h-8" : "w-10 h-10",
                  isActive && "bg-phosphor-amber/20 border-phosphor-amber scale-110",
                  isPast && "bg-phosphor-green/20 border-phosphor-green",
                  !isActive && !isPast && "bg-terminal border-surface-border"
                )}
                title={s.label}
              >
                {isPast ? (
                  <CheckCircle className={cn(
                    isCompact ? "w-4 h-4" : "w-5 h-5",
                    "text-phosphor-green"
                  )} />
                ) : (
                  <StageIcon className={cn(
                    isCompact ? "w-4 h-4" : "w-5 h-5",
                    isActive ? "text-phosphor-amber" : "text-text-tertiary",
                    isActive && s.name === 'flip' && "animate-spin",
                    isActive && s.icon === 'camera' && "animate-pulse"
                  )} />
                )}
              </div>
              
              {/* Label - always show */}
              <span
                className={cn(
                  "font-mono mt-1 whitespace-nowrap",
                  isCompact ? "text-[9px]" : "text-xs",
                  isActive ? "text-phosphor-amber font-bold" : 
                  isPast ? "text-phosphor-green" : "text-text-tertiary"
                )}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InspectionStage

'use client'

/**
 * InspectionStage Component - ENHANCED WOW VERSION
 * Shows loading/progress animation during inspection capture and processing
 * 
 * Features:
 * - Animated scanning rings
 * - Glow effects with pulsing
 * - Gradient progress bar with sweep animation
 * - Floating icon animation
 * - Shimmer effects on completed stages
 * - Full i18n support
 */

import { cn } from '@/lib/utils'
import { useI18n } from '@/context/I18nContext'
import { 
  Loader2, 
  Camera, 
  Cpu, 
  CheckCircle, 
  Clock, 
  Box, 
  Package, 
  RotateCcw,
  Circle,
  Scan,
  CircleDot,
  Pause,
  Square,
  Play
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
  'scan': Scan,
  'default': CircleDot
}

// Default fallback stages if none provided
const DEFAULT_STAGES = [
  { stage_id: 'stage-01', name: 'start', label: 'Board', icon: 'box' },
  { stage_id: 'stage-02', name: 'running', label: 'Process', icon: 'cpu' },
  { stage_id: 'stage-03', name: 'done', label: 'Done', icon: 'check' }
]

export function InspectionStage({ stage, stageDefinitions, processStatus, onResume, isOperator = true, className }) {
  const { t } = useI18n()
  const { status, stageName, message, stageIndex } = stage
  
  // Message mapping by stage name (with i18n)
  const getStageMessage = (name) => {
    const messages = {
      'idle': t('hmi.waitingForBoard'),
      'start': t('hmi.waitingForBoard'),
      'position_1': t('hmi.capturing'),
      'position_2': t('hmi.capturing'),
      'flip': t('hmi.processing'),
      'position_3': t('hmi.capturing'),
      'position_4': t('hmi.capturing'),
      'running': t('hmi.processing'),
      'done': t('hmi.processing')
    }
    return messages[name] || t('hmi.processing')
  }
  
  // Use provided stages or fallback
  const stages = stageDefinitions?.length > 0 ? stageDefinitions : DEFAULT_STAGES
  const actualTotalStages = stages.length
  const isCompact = stages.length > 5

  // Get icon component from name
  const getIcon = (iconName) => ICON_MAP[iconName] || ICON_MAP['default']

  // Machine PAUSED state
  if (processStatus === 'PAUSED') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        className
      )}>
        <div className="relative mb-8">
          {/* Amber pulsing ring */}
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-phosphor-amber/30 animate-pulse" />
          
          {/* Main icon container */}
          <div className="relative w-32 h-32 border-2 border-phosphor-amber/50 rounded-full flex items-center justify-center bg-phosphor-amber/10 backdrop-blur-sm">
            <Pause className="w-14 h-14 text-phosphor-amber" />
          </div>
        </div>
        
        <p className="text-2xl text-phosphor-amber font-display font-bold tracking-wider mb-2">
          {t('hmi.machinePaused')}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {t('hmi.waitingToResume')}
        </p>

        {/* Resume Button - Only for Operator */}
        {isOperator ? (
          <button
            onClick={onResume}
            className={cn(
              "flex items-center gap-3 px-8 py-4 border-2 transition-all",
              "font-display text-sm font-bold tracking-wider",
              "border-phosphor-green text-phosphor-green",
              "hover:bg-phosphor-green hover:text-void"
            )}
          >
            <Play className="w-5 h-5" />
            {t('buttons.resume').toUpperCase()}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border border-surface-border bg-surface-border/10">
            <span className="font-mono text-xs text-text-tertiary">{t('hmi.viewOnlyCannotControl')}</span>
          </div>
        )}
      </div>
    )
  }

  // Machine STOPPED state
  if (processStatus === 'STOPPED') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        className
      )}>
        <div className="relative mb-8">
          {/* Red ring */}
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-phosphor-red/30" />
          
          {/* Main icon container */}
          <div className="relative w-32 h-32 border-2 border-phosphor-red/50 rounded-full flex items-center justify-center bg-phosphor-red/10 backdrop-blur-sm">
            <Square className="w-14 h-14 text-phosphor-red" />
          </div>
        </div>
        
        <p className="text-2xl text-phosphor-red font-display font-bold tracking-wider mb-2">
          {t('hmi.machineStopped')}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {isOperator ? t('hmi.waitingForOperator') : t('hmi.waitingForOperator')}
        </p>

        {/* Start Button - Only for Operator */}
        {isOperator ? (
          <button
            onClick={onResume}
            className={cn(
              "flex items-center gap-3 px-8 py-4 border-2 transition-all",
              "font-display text-sm font-bold tracking-wider",
              "border-phosphor-green text-phosphor-green",
              "hover:bg-phosphor-green hover:text-void"
            )}
          >
            <Play className="w-5 h-5" />
            {t('buttons.start').toUpperCase()}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border border-surface-border bg-surface-border/10">
            <span className="font-mono text-xs text-text-tertiary">{t('hmi.viewOnlyCannotControl')}</span>
          </div>
        )}
      </div>
    )
  }

  // Machine IDLE state - not started yet
  if (processStatus === 'IDLE') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        className
      )}>
        <div className="relative mb-8">
          {/* Gray ring */}
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-surface-border/50" />
          
          {/* Main icon container */}
          <div className="relative w-32 h-32 border-2 border-surface-border rounded-full flex items-center justify-center bg-terminal/50 backdrop-blur-sm">
            <Play className="w-14 h-14 text-text-tertiary" />
          </div>
        </div>
        
        <p className="text-2xl text-text-secondary font-display font-bold tracking-wider mb-2">
          {t('status.ready').toUpperCase()}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {isOperator ? t('hmi.waitingForOperator') : t('hmi.waitingForOperator')}
        </p>

        {/* Start Button - Only for Operator */}
        {isOperator ? (
          <button
            onClick={onResume}
            className={cn(
              "flex items-center gap-3 px-8 py-4 border-2 transition-all",
              "font-display text-sm font-bold tracking-wider",
              "border-phosphor-green text-phosphor-green",
              "hover:bg-phosphor-green hover:text-void"
            )}
          >
            <Play className="w-5 h-5" />
            {t('buttons.start').toUpperCase()}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border border-surface-border bg-surface-border/10">
            <span className="font-mono text-xs text-text-tertiary">{t('hmi.viewOnlyCannotControl')}</span>
          </div>
        )}
      </div>
    )
  }

  // Idle state - waiting for board (RUNNING but no board yet)
  if (status === 'idle') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        className
      )}>
        {/* Enhanced waiting indicator with multiple rings */}
        <div className="relative mb-8">
          {/* Outer scanning ring */}
          <div className="absolute inset-[-16px] w-[160px] h-[160px] rounded-full border-2 border-dashed border-text-tertiary/30 animate-stage-ring-spin" />
          
          {/* Middle pulsing ring */}
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border border-phosphor-amber/20 animate-pulse" />
          
          {/* Main icon container */}
          <div className="relative w-32 h-32 border-2 border-surface-border rounded-full flex items-center justify-center bg-terminal/50 backdrop-blur-sm">
            <Clock className="w-14 h-14 text-text-tertiary animate-pulse" />
          </div>
          
          {/* Ripple effect */}
          <div className="absolute inset-0 w-32 h-32 border-2 border-phosphor-amber/30 rounded-full animate-stage-ripple" />
        </div>
        
        <p className="text-2xl text-text-secondary font-display font-bold tracking-wider mb-2">
          {t('hmi.waitingForBoard').toUpperCase()}
        </p>
        <p className="text-sm text-text-tertiary font-mono">
          {t('status.ready')}
        </p>

        {/* Stage dots with labels (all inactive) */}
        <div className={cn("flex mt-8", isCompact ? "gap-3" : "gap-4")}>
          {stages.map((s) => {
            const StageIcon = getIcon(s.icon)
            return (
              <div key={s.stage_id} className="flex flex-col items-center group">
                <div
                  className={cn(
                    "rounded-full bg-terminal border-2 border-surface-border flex items-center justify-center",
                    "transition-all duration-300 group-hover:border-text-tertiary/50",
                    isCompact ? "w-9 h-9" : "w-11 h-11"
                  )}
                  title={s.label}
                >
                  <StageIcon className={cn(
                    "text-text-tertiary transition-colors group-hover:text-text-secondary",
                    isCompact ? "w-4 h-4" : "w-5 h-5"
                  )} />
                </div>
                <span className={cn(
                  "font-mono text-text-tertiary mt-1.5 transition-colors group-hover:text-text-secondary",
                  isCompact ? "text-[10px]" : "text-xs"
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
  const isCamera = currentStageDef?.icon === 'camera'

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full",
      className
    )}>
      {/* Enhanced Stage Icon with animations */}
      <div className="relative mb-6">
        {/* Outer scanning ring - only when active */}
        {!isComplete && (
          <div className="absolute inset-[-20px] w-[152px] h-[152px]">
            <svg className="w-full h-full animate-stage-ring-spin" viewBox="0 0 152 152">
              <defs>
                <linearGradient id="scanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(245, 158, 11, 0)" />
                  <stop offset="50%" stopColor="rgba(245, 158, 11, 0.6)" />
                  <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                </linearGradient>
              </defs>
              <circle 
                cx="76" 
                cy="76" 
                r="72" 
                fill="none" 
                stroke="url(#scanGradient)" 
                strokeWidth="2"
                strokeDasharray="120 340"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
        
        {/* Secondary ring with dots */}
        {!isComplete && (
          <div className="absolute inset-[-10px] w-[132px] h-[132px]">
            <svg className="w-full h-full animate-stage-ring-spin" style={{ animationDirection: 'reverse', animationDuration: '12s' }} viewBox="0 0 132 132">
              <circle cx="66" cy="66" r="62" fill="none" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" strokeDasharray="4 8" />
            </svg>
          </div>
        )}

        {/* Main icon container with glow */}
        <div className={cn(
          "relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500",
          "border-4 backdrop-blur-sm",
          isComplete 
            ? "border-phosphor-green/60 bg-phosphor-green/10 animate-stage-glow-green" 
            : "border-phosphor-amber/60 bg-phosphor-amber/10 animate-stage-glow-pulse"
        )}>
          {/* Inner glow ring */}
          <div className={cn(
            "absolute inset-2 rounded-full",
            isComplete 
              ? "bg-gradient-to-br from-phosphor-green/20 to-transparent" 
              : "bg-gradient-to-br from-phosphor-amber/20 to-transparent"
          )} />
          
          {/* Icon with float animation */}
          <CurrentIcon className={cn(
            "w-12 h-12 relative z-10 transition-all duration-300",
            isComplete ? "text-phosphor-green" : "text-phosphor-amber",
            !isComplete && "animate-stage-float",
            isFlipping && "animate-spin",
            isCamera && !isComplete && "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          )} />
        </div>
        
        {/* Ripple effects - multiple layers */}
        {!isComplete && (
          <>
            <div className="absolute inset-0 w-28 h-28 border-2 border-phosphor-amber/40 rounded-full animate-stage-ripple" />
            <div className="absolute inset-0 w-28 h-28 border border-phosphor-amber/20 rounded-full animate-stage-ripple" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        {/* Complete checkmark overlay */}
        {isComplete && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-phosphor-green rounded-full flex items-center justify-center border-2 border-terminal shadow-lg shadow-phosphor-green/30">
            <CheckCircle className="w-5 h-5 text-terminal" />
          </div>
        )}
      </div>

      {/* Message + Stage Name */}
      <p className={cn(
        "text-2xl font-display font-bold tracking-wider mb-1 transition-colors",
        isComplete ? "text-phosphor-green" : "text-text-primary"
      )}>
        {message || getStageMessage(stageName)}
      </p>
      
      {/* Current Stage Name */}
      <p className={cn(
        "text-sm font-mono mb-4 px-3 py-1 rounded-full",
        isComplete 
          ? "text-phosphor-green/80 bg-phosphor-green/10" 
          : "text-phosphor-amber/80 bg-phosphor-amber/10"
      )}>
        [{currentStageDef?.label || stageName}]
      </p>

      {/* Enhanced Progress Bar with gradient sweep */}
      <div className="w-96 mb-3">
        <div className="h-2.5 bg-surface-border/50 rounded-full overflow-hidden backdrop-blur-sm border border-surface-border/30">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out rounded-full relative",
              isComplete 
                ? "bg-phosphor-green" 
                : "animate-stage-progress-sweep"
            )}
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer overlay on progress */}
            {!isComplete && (
              <div className="absolute inset-0 animate-stage-shimmer" />
            )}
          </div>
        </div>
      </div>

      {/* Stage Counter */}
      <p className="text-sm text-text-tertiary font-mono mb-5">
        Stage {stageIndex} / {actualTotalStages}
      </p>

      {/* Enhanced Stage Progress indicators */}
      <div className={cn("flex items-end", isCompact ? "gap-3" : "gap-5")}>
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
              {/* Enhanced Icon/Dot container */}
              <div className="relative">
                {/* Active glow ring */}
                {isActive && (
                  <div className="absolute inset-[-4px] rounded-full bg-phosphor-amber/20 animate-stage-dot-pulse" />
                )}
                
                {/* Completed shimmer ring */}
                {isPast && (
                  <div className="absolute inset-[-2px] rounded-full bg-gradient-to-r from-phosphor-green/0 via-phosphor-green/30 to-phosphor-green/0 animate-stage-shimmer" />
                )}
                
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center transition-all duration-300 border-2 relative",
                    isCompact ? "w-9 h-9" : "w-11 h-11",
                    isActive && "bg-phosphor-amber/20 border-phosphor-amber scale-110 shadow-lg shadow-phosphor-amber/30",
                    isPast && "bg-phosphor-green/20 border-phosphor-green shadow-md shadow-phosphor-green/20",
                    !isActive && !isPast && "bg-terminal/80 border-surface-border hover:border-text-tertiary/50"
                  )}
                  title={s.label}
                >
                  {isPast ? (
                    <CheckCircle className={cn(
                      isCompact ? "w-5 h-5" : "w-6 h-6",
                      "text-phosphor-green drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                    )} />
                  ) : (
                    <StageIcon className={cn(
                      isCompact ? "w-4 h-4" : "w-5 h-5",
                      isActive ? "text-phosphor-amber drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" : "text-text-tertiary",
                      isActive && s.name === 'flip' && "animate-spin",
                      isActive && s.icon === 'camera' && "animate-pulse"
                    )} />
                  )}
                </div>
              </div>
              
              {/* Label with enhanced styling */}
              <span
                className={cn(
                  "font-mono mt-2 whitespace-nowrap transition-all duration-300",
                  isCompact ? "text-[10px]" : "text-xs",
                  isActive && "text-phosphor-amber font-bold scale-105",
                  isPast && "text-phosphor-green font-medium",
                  !isActive && !isPast && "text-text-tertiary"
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

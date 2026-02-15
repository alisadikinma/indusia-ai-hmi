'use client'

/**
 * InspectionStage Component - Step Cards Design
 * Shows 7 horizontal step cards with progress bar during inspection
 *
 * Visual Phases:
 * PCB IN → CAMERA MOVE → CAPTURE TOP → FLIP → CAPTURE BTM → AI INSPECT → RESULT
 *
 * States:
 * - IDLE/PAUSED/STOPPED: Full overlay with action buttons
 * - RUNNING (waiting for board): Step cards dimmed + waiting message
 * - RUNNING (processing): Step cards with active/completed/future states
 */

import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/context/I18nContext'
import {
  CheckCircle,
  Clock,
  Pause,
  Square,
  Play,
  ArrowRightToLine,
  Move,
  Scan,
  FlipHorizontal2,
  ScanLine,
  Brain,
  ClipboardCheck,
  Loader2
} from 'lucide-react'

// ============================================
// 7 Visual Phases
// ============================================

const VISUAL_PHASES = [
  { key: 'pcb_in',         labelKey: 'inspection.phasePcbIn',       icon: ArrowRightToLine },
  { key: 'camera_move',    labelKey: 'inspection.phaseCameraMove',  icon: Move },
  { key: 'capture_top',    labelKey: 'inspection.phaseCaptureTop',  icon: Scan },
  { key: 'flip',           labelKey: 'inspection.phaseFlip',        icon: FlipHorizontal2 },
  { key: 'capture_bottom', labelKey: 'inspection.phaseCaptureBtm',  icon: ScanLine },
  { key: 'ai_inspect',     labelKey: 'inspection.phaseAiInspect',   icon: Brain },
  { key: 'result',         labelKey: 'inspection.phaseResult',      icon: ClipboardCheck },
]

// ============================================
// Phase Mapping: Backend Stages → Visual Phase
// ============================================

/**
 * Map current inspection state to one of the 7 visual phase indices.
 *
 * Uses the `message` string set by useLiveInspection event handlers,
 * which always reflects the most recent activity (motion or vision).
 *
 * NOTE: We cannot rely on stageDefinitions[stageIndex - 1] because
 * stageIndex = max(motionStageIndex, visionStageIndex), so the lookup
 * may point to a vision-TOP definition while motion is already on the
 * bottom side — causing FLIP and CAPTURE BTM to appear skipped.
 */
function getActivePhaseIndex(stage) {
  const { stageIndex, status, stageName, message } = stage

  // Result arrived or done → phase 6 (RESULT)
  if (status === 'ready') return 6
  if (stageName === 'done') return 6

  // No progress yet
  if (!stageIndex || stageIndex <= 0) return 0

  // Primary: use message string for reliable phase detection
  if (message) {
    const msg = message.toLowerCase()

    if (msg.includes('board incoming')) return 0            // PCB IN
    if (msg.includes('flipping'))      return 3            // FLIP
    if (msg.includes('starting bottom')) return 4          // Just after FLIP
    if (msg.includes('motion complete')) return 6          // RESULT

    // Vision stages (check before generic position to catch "Capturing"/"AI processing")
    if (msg.includes('capturing top') || msg.includes('ai processing top'))       return 2 // CAPTURE TOP
    if (msg.includes('capturing bottom') || msg.includes('ai processing bottom')) return 5 // AI INSPECT

    // Camera moving to position (motion stage)
    if (msg.includes('(top)'))    return 1                 // CAMERA MOVE (top)
    if (msg.includes('(bottom)')) return 4                 // CAPTURE BTM (bottom motion)
  }

  // Fallback: proportional mapping for legacy formats without message
  const totalStages = stage.totalStages || 1
  const ratio = stageIndex / totalStages
  if (ratio <= 0.1) return 0
  if (ratio <= 0.25) return 1
  if (ratio <= 0.4) return 2
  if (ratio <= 0.5) return 3
  if (ratio <= 0.65) return 4
  if (ratio <= 0.9) return 5
  return 6
}

// ============================================
// Step Card Component
// ============================================

function StepCard({ phase, index, activePhaseIndex, isIdle, t }) {
  const isCompleted = !isIdle && index < activePhaseIndex
  const isActive = !isIdle && index === activePhaseIndex
  const isFuture = isIdle || index > activePhaseIndex

  const Icon = phase.icon

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className={cn(
        "relative w-full aspect-square flex flex-col items-center justify-center",
        "rounded-lg border-2 transition-all duration-300",
        isCompleted && "bg-phosphor-green/10 border-phosphor-green/40",
        isActive && "bg-phosphor-teal/15 border-phosphor-teal/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
        isFuture && "bg-terminal/40 border-surface-border/40"
      )}>
        {/* Active pulse overlay */}
        {isActive && (
          <div className="absolute inset-0 rounded-lg border-2 border-phosphor-teal/30 animate-pulse" />
        )}

        <Icon className={cn(
          "w-7 h-7 mb-1.5 transition-all duration-300",
          isCompleted && "text-phosphor-green",
          isActive && "text-phosphor-teal drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]",
          isFuture && "text-text-tertiary/40"
        )} />

        <span className={cn(
          "font-display text-[9px] font-bold tracking-wider text-center leading-tight px-1",
          isCompleted && "text-phosphor-green/90",
          isActive && "text-phosphor-teal",
          isFuture && "text-text-tertiary/40"
        )}>
          {t(phase.labelKey)}
        </span>

        {/* Completed checkmark badge */}
        {isCompleted && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-terminal rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-phosphor-green" />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Step Connector (line between cards)
// ============================================

function StepConnector({ completed }) {
  return (
    <div className={cn(
      "flex-shrink-0 w-3 h-0.5 self-center transition-colors duration-300",
      completed ? "bg-phosphor-green/40" : "bg-surface-border/40"
    )} />
  )
}

// ============================================
// Main Component
// ============================================

export function InspectionStage({ stage, stageDefinitions, processStatus, onResume, isOperator = true, className }) {
  const { t } = useI18n()
  const { status, stageName, message, stageIndex } = stage

  const stages = stageDefinitions?.length > 0 ? stageDefinitions : []
  const actualTotalStages = stages.length || stage.totalStages || 1

  // ---- Machine PAUSED state ----
  if (processStatus === 'PAUSED') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <div className="relative mb-8">
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-phosphor-teal/30 animate-pulse" />
          <div className="relative w-32 h-32 border-2 border-phosphor-teal/50 rounded-full flex items-center justify-center bg-phosphor-teal/10 backdrop-blur-sm">
            <Pause className="w-14 h-14 text-phosphor-teal" />
          </div>
        </div>
        <p className="text-2xl text-phosphor-teal font-display font-bold tracking-wider mb-2">
          {t('hmi.machinePaused')}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {t('hmi.waitingToResume')}
        </p>
        {isOperator ? (
          <button onClick={onResume} className="flex items-center gap-3 px-8 py-4 border-2 transition-all font-display text-sm font-bold tracking-wider border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void">
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

  // ---- Machine STOPPED state ----
  if (processStatus === 'STOPPED') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <div className="relative mb-8">
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-phosphor-red/30" />
          <div className="relative w-32 h-32 border-2 border-phosphor-red/50 rounded-full flex items-center justify-center bg-phosphor-red/10 backdrop-blur-sm">
            <Square className="w-14 h-14 text-phosphor-red" />
          </div>
        </div>
        <p className="text-2xl text-phosphor-red font-display font-bold tracking-wider mb-2">
          {t('hmi.machineStopped')}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {t('hmi.waitingForOperator')}
        </p>
        {isOperator ? (
          <button onClick={onResume} className="flex items-center gap-3 px-8 py-4 border-2 transition-all font-display text-sm font-bold tracking-wider border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void">
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

  // ---- Machine IDLE state ----
  if (processStatus === 'IDLE') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <div className="relative mb-8">
          <div className="absolute inset-[-8px] w-[144px] h-[144px] rounded-full border-2 border-surface-border/50" />
          <div className="relative w-32 h-32 border-2 border-surface-border rounded-full flex items-center justify-center bg-terminal/50 backdrop-blur-sm">
            <Play className="w-14 h-14 text-text-tertiary" />
          </div>
        </div>
        <p className="text-2xl text-text-secondary font-display font-bold tracking-wider mb-2">
          {t('status.ready').toUpperCase()}
        </p>
        <p className="text-sm text-text-tertiary font-mono mb-6">
          {t('hmi.waitingForOperator')}
        </p>
        {isOperator ? (
          <button onClick={onResume} className="flex items-center gap-3 px-8 py-4 border-2 transition-all font-display text-sm font-bold tracking-wider border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void">
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

  // ============================================
  // RUNNING STATE — Step Cards + Progress Bar
  // ============================================

  const isWaitingForBoard = status === 'idle'
  const activePhaseIndex = isWaitingForBoard ? -1 : getActivePhaseIndex(stage)
  const progress = Math.min((stageIndex / actualTotalStages) * 100, 100)
  const isComplete = status === 'ready'

  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      {/* Stage Message */}
      {isWaitingForBoard ? (
        <>
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-text-tertiary/30 flex items-center justify-center animate-stage-ring-spin">
              <Clock className="w-8 h-8 text-text-tertiary animate-pulse" />
            </div>
          </div>
          <p className="text-xl font-display font-bold tracking-wider text-text-secondary mb-1">
            {t('hmi.waitingForBoard').toUpperCase()}
          </p>
          <p className="text-sm font-mono text-text-tertiary mb-6">
            {t('status.ready')}
          </p>
        </>
      ) : (
        <>
          {/* Processing / Complete icon */}
          <div className="relative mb-4">
            {isComplete ? (
              <div className="w-16 h-16 rounded-full border-2 border-phosphor-green/50 flex items-center justify-center bg-phosphor-green/10">
                <CheckCircle className="w-8 h-8 text-phosphor-green" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-phosphor-teal/40 flex items-center justify-center bg-phosphor-teal/10">
                <Loader2 className="w-8 h-8 text-phosphor-teal animate-spin" />
              </div>
            )}
          </div>

          <p className={cn(
            "text-xl font-display font-bold tracking-wider mb-1",
            isComplete ? "text-phosphor-green" : "text-text-primary"
          )}>
            {message || t('hmi.processing')}
          </p>
          <p className="text-sm font-mono text-text-tertiary mb-6">
            {t('inspection.stage')} {stageIndex} / {actualTotalStages}
          </p>
        </>
      )}

      {/* 8 Step Cards */}
      <div className="flex items-start gap-1 w-full max-w-3xl px-4">
        {VISUAL_PHASES.map((phase, i) => (
          <Fragment key={phase.key}>
            {i > 0 && (
              <StepConnector completed={!isWaitingForBoard && i <= activePhaseIndex} />
            )}
            <StepCard
              phase={phase}
              index={i}
              activePhaseIndex={activePhaseIndex}
              isIdle={isWaitingForBoard}
              t={t}
            />
          </Fragment>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-3xl mt-6 px-4">
        <div className="h-3 bg-surface-border/30 overflow-hidden border border-surface-border/30">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out relative",
              isComplete
                ? "bg-phosphor-green"
                : isWaitingForBoard
                  ? "bg-surface-border/50"
                  : "animate-stage-progress-sweep"
            )}
            style={{ width: isWaitingForBoard ? '0%' : `${progress}%` }}
          >
            {!isComplete && !isWaitingForBoard && (
              <div className="absolute inset-0 animate-stage-shimmer" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-center mt-2">
          <span className={cn(
            "font-mono text-sm font-bold tracking-wider",
            isComplete ? "text-phosphor-green" : isWaitingForBoard ? "text-text-tertiary/50" : "text-text-secondary"
          )}>
            {t('inspection.progressLabel')}: {isWaitingForBoard ? '0' : Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default InspectionStage

/**
 * Inspection Components Index
 * Export all inspection-related components for cleaner imports
 */

// Core inspection components
export { LiveView } from './LiveView'
export { DetectionOverlay } from './DetectionOverlay'
export { default as FalseCallOverrideModal } from './FalseCallOverrideModal'
export { default as OverrideReviewModal } from './OverrideReviewModal'

// HMI Operator Mode components
export { HMIOperatorView } from './HMIOperatorView'
export { HMIActionPanel } from './HMIActionPanel'
export { HMITimer } from './HMITimer'

// LiveView V3 - Work Order integrated (current version)
export { LiveViewV3 } from './LiveViewV3'
export { NextPCBConfirmModal } from './NextPCBConfirmModal'

// LiveViewV3 dependencies
export { DefectViewPanel } from './DefectViewPanel'
export { DetectionResultPanel } from './DetectionResultPanel'
export { BoardOverview } from './BoardOverview'
export { FalseCallModal } from './FalseCallModal'

// LiveViewV3 Dual View components (Phase 15)
export { InspectionStage } from './InspectionStage'
export { InspectionResult } from './InspectionResult'
export { SidePanel } from './SidePanel'
export { AIDecisionPanel } from './AIDecisionPanel'

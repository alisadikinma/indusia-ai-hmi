# Phase 15: HMI LiveView Rework — Inspection Flow Redesign

## Objective

Redesign LiveView HMI to match actual inspection flow:
1. Show loading animation during stage progress (TOP → BOTTOM capture)
2. Display BOTH TOP + BOTTOM images after inspection complete
3. Single GOOD/NG decision per board (not per side)

---

## Current vs New Flow

### ❌ Current (Wrong)
```
SSE: inspection (side: TOP)
→ Show TOP image
→ Operator: GOOD/NG

SSE: inspection (side: BOTTOM)  
→ Show BOTTOM image
→ Operator: GOOD/NG
```

### ✅ New (Correct)
```
SSE: running_status (camera_capture_top)
→ Show: "🔄 Capturing TOP side..."

SSE: running_status (ai_processing_top)
→ Show: "🔄 Processing TOP side..."

SSE: running_status (pcb_flipping)
→ Show: "🔄 Flipping PCB..."

SSE: running_status (camera_capture_bottom)
→ Show: "🔄 Capturing BOTTOM side..."

SSE: running_status (ai_processing_bottom)
→ Show: "🔄 Processing BOTTOM side..."

SSE: running_status (inspection_complete)
→ Show: "⏳ Ready for review"

SSE: inspection (results: { top: {...}, bottom: {...} })
→ Show: TOP image + BOTTOM image side by side
→ Show: All defects from both sides
→ Operator: GOOD/NG (one decision for entire board)

POST /confirm
→ Next board cycle starts
```

---

## HMI States

### State 1: Idle/Waiting

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Board #23 | WO-2026-001 | Line: SMT-01                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                  ⏳ Waiting for board...                        │
│                                                                 │
│                     [Subtle pulse animation]                    │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Inspected: 22 | Good: 20 | NG: 2 | Yield: 90.9%               │
└─────────────────────────────────────────────────────────────────┘
```

### State 2: Capturing/Processing (from running_status)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Board #23 | WO-2026-001 | Line: SMT-01                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                  🔄 Capturing TOP side...                       │
│                                                                 │
│                  ████████████░░░░░░░░  45%                      │
│                                                                 │
│                  Stage: camera_capture_top                      │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Inspected: 22 | Good: 20 | NG: 2 | Yield: 90.9%               │
└─────────────────────────────────────────────────────────────────┘
```

### State 3: Ready for Review (from inspection event)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Board #23 | WO-2026-001 | Line: SMT-01 | ⏱️ 00:05     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │    TOP Side         │    │   BOTTOM Side       │            │
│  │                     │    │                     │            │
│  │  [Image + BBox]     │    │  [Image + BBox]     │            │
│  │                     │    │                     │            │
│  │  🔴 2 defects       │    │  🟢 0 defects       │            │
│  └─────────────────────┘    └─────────────────────┘            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  AI Decision: FAIL                                        │ │
│  │  Confidence: 94%                                          │ │
│  │  Defects: solder_bridge (TOP), cold_solder (TOP)          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│      ┌─────────────────┐        ┌─────────────────┐            │
│      │                 │        │                 │            │
│      │      GOOD       │        │       NG        │            │
│      │       (G)       │        │       (N)       │            │
│      │                 │        │                 │            │
│      └─────────────────┘        └─────────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Inspected: 22 | Good: 20 | NG: 2 | Yield: 90.9%               │
└─────────────────────────────────────────────────────────────────┘
```

---

## SSE Events to Handle

### 1. `running_status` — Progress Indicator

```typescript
interface RunningStatusEvent {
  status_id: string
  timestamp: string
  stage_id: string
  stage_name: 'unit_coming' | 'camera_capture_top' | 'ai_processing_top' | 
              'pcb_flipping' | 'camera_capture_bottom' | 'ai_processing_bottom' |
              'inspection_complete'
  completed: boolean
}
```

**UI Action:**
- Update loading message based on `stage_name`
- Show progress bar (7 stages total)
- When `stage_name === 'inspection_complete'`, prepare for inspection event

### 2. `inspection` — Final Result

```typescript
interface InspectionEvent {
  inspection_id: string
  model_id: string
  model_name: string
  results: {
    top: {
      image_url: string
      objects: Array<{
        name: string
        box: [number, number, number, number]
        label: number
        score: number
        crop_url: string  // ← New: cropped defect image
      }>
    }
    bottom: {
      image_url: string
      objects: Array<{...}>
    }
  }
  decision: 'PASS' | 'FAIL'
  timestamp: string
}
```

**UI Action:**
- Display TOP and BOTTOM images side by side
- Render bounding boxes on both images
- Show defect list from both sides
- Enable GOOD/NG buttons
- Start timer for operator decision

### 3. `confirmed` — After Operator Decision

```typescript
interface ConfirmedEvent {
  board_sequence: number
  decision: 'GOOD' | 'NG'
  inspected_count: number
  lot_size: number
}
```

**UI Action:**
- Update statistics
- Reset to State 1 (Waiting)
- Wait for next board

---

## Component Structure

```
app/inspection/live/[lineId]/page.jsx
└── LiveViewV3.jsx (main container)
    ├── LiveHeader.jsx (board info, timer, connection status)
    ├── InspectionStage.jsx (NEW: loading/progress display)
    │   ├── StageProgress.jsx (progress bar with stage labels)
    │   └── LoadingAnimation.jsx (spinner + message)
    ├── InspectionResult.jsx (NEW: dual-side image display)
    │   ├── SidePanel.jsx (single side: image + defects)
    │   │   ├── ImageViewer.jsx (image + bbox overlay)
    │   │   └── DefectList.jsx (list of defects for this side)
    │   └── AIDecisionPanel.jsx (overall decision + confidence)
    ├── OperatorButtons.jsx (GOOD/NG buttons)
    └── LiveFooter.jsx (statistics)
```

---

## Task 1: Update useLiveInspection Hook

### File: `hooks/useLiveInspection.js`

Add new state for inspection stage:

```javascript
// New state
const [inspectionStage, setInspectionStage] = useState({
  status: 'idle',  // 'idle' | 'capturing' | 'processing' | 'ready'
  stageName: null,
  stageIndex: 0,
  totalStages: 7
})

// Handle running_status event
service.on('running_status', (data) => {
  setRunningStatus(data)
  
  // Map stage_name to UI status
  const stageMap = {
    'unit_coming': { status: 'capturing', message: 'Board incoming...' },
    'camera_capture_top': { status: 'capturing', message: 'Capturing TOP side...' },
    'ai_processing_top': { status: 'processing', message: 'Processing TOP side...' },
    'pcb_flipping': { status: 'capturing', message: 'Flipping PCB...' },
    'camera_capture_bottom': { status: 'capturing', message: 'Capturing BOTTOM side...' },
    'ai_processing_bottom': { status: 'processing', message: 'Processing BOTTOM side...' },
    'inspection_complete': { status: 'ready', message: 'Ready for review' }
  }
  
  const stageInfo = stageMap[data.stage_name] || { status: 'idle', message: '' }
  const stageIndex = Object.keys(stageMap).indexOf(data.stage_name) + 1
  
  setInspectionStage({
    status: stageInfo.status,
    stageName: data.stage_name,
    message: stageInfo.message,
    stageIndex,
    totalStages: 7
  })
})

// Handle inspection event
service.on('inspection', (data) => {
  setCurrentInspection(data)
  setInspectionStage({
    status: 'ready',
    stageName: 'inspection_complete',
    message: 'Ready for review',
    stageIndex: 7,
    totalStages: 7
  })
})

// Handle confirmed event (reset)
service.on('confirmed', (data) => {
  setLastConfirmation(data)
  setCurrentInspection(null)
  setInspectionStage({
    status: 'idle',
    stageName: null,
    stageIndex: 0,
    totalStages: 7
  })
})
```

---

## Task 2: Create InspectionStage Component

### File: `components/inspection/InspectionStage.jsx`

```jsx
'use client'

import { cn } from '@/lib/utils'
import { Loader2, Camera, Cpu, RotateCw, CheckCircle } from 'lucide-react'

const STAGE_ICONS = {
  'unit_coming': Loader2,
  'camera_capture_top': Camera,
  'ai_processing_top': Cpu,
  'pcb_flipping': RotateCw,
  'camera_capture_bottom': Camera,
  'ai_processing_bottom': Cpu,
  'inspection_complete': CheckCircle
}

export default function InspectionStage({ stage, className }) {
  const { status, stageName, message, stageIndex, totalStages } = stage
  
  if (status === 'idle') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <div className="text-6xl mb-4 animate-pulse">⏳</div>
        <p className="text-xl text-indusia-textMuted">Waiting for board...</p>
      </div>
    )
  }
  
  const Icon = STAGE_ICONS[stageName] || Loader2
  const progress = (stageIndex / totalStages) * 100
  
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Icon className={cn(
        "w-16 h-16 mb-4",
        status === 'ready' ? "text-green-400" : "text-indusia-primary animate-spin"
      )} />
      
      <p className="text-xl text-indusia-text mb-4">{message}</p>
      
      {/* Progress Bar */}
      <div className="w-64 h-2 bg-indusia-border rounded-full overflow-hidden">
        <div 
          className="h-full bg-indusia-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-sm text-indusia-textMuted mt-2">
        Stage {stageIndex} of {totalStages}
      </p>
    </div>
  )
}
```

---

## Task 3: Create InspectionResult Component

### File: `components/inspection/InspectionResult.jsx`

```jsx
'use client'

import { cn } from '@/lib/utils'
import SidePanel from './SidePanel'
import AIDecisionPanel from './AIDecisionPanel'

export default function InspectionResult({ inspection, className }) {
  if (!inspection) return null
  
  const { results, decision, timestamp } = inspection
  
  // Count total defects
  const topDefects = results.top?.objects?.length || 0
  const bottomDefects = results.bottom?.objects?.length || 0
  const totalDefects = topDefects + bottomDefects
  
  // Calculate average confidence
  const allObjects = [
    ...(results.top?.objects || []),
    ...(results.bottom?.objects || [])
  ]
  const avgConfidence = allObjects.length > 0
    ? allObjects.reduce((sum, obj) => sum + obj.score, 0) / allObjects.length
    : 0
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Dual Side Images */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <SidePanel 
          side="TOP"
          imageUrl={results.top?.image_url}
          objects={results.top?.objects || []}
        />
        <SidePanel 
          side="BOTTOM"
          imageUrl={results.bottom?.image_url}
          objects={results.bottom?.objects || []}
        />
      </div>
      
      {/* AI Decision Summary */}
      <AIDecisionPanel 
        decision={decision}
        confidence={avgConfidence}
        totalDefects={totalDefects}
        defects={allObjects}
      />
    </div>
  )
}
```

---

## Task 4: Create SidePanel Component

### File: `components/inspection/SidePanel.jsx`

```jsx
'use client'

import { cn } from '@/lib/utils'
import ImageWithBBox from './ImageWithBBox'

export default function SidePanel({ side, imageUrl, objects, className }) {
  const hasDefects = objects.length > 0
  
  return (
    <div className={cn(
      "bg-indusia-surface rounded-lg overflow-hidden flex flex-col",
      className
    )}>
      {/* Side Header */}
      <div className={cn(
        "px-3 py-2 flex items-center justify-between",
        hasDefects ? "bg-red-500/20" : "bg-green-500/20"
      )}>
        <span className="font-semibold text-indusia-text">{side} Side</span>
        <span className={cn(
          "text-sm font-medium",
          hasDefects ? "text-red-400" : "text-green-400"
        )}>
          {hasDefects ? `🔴 ${objects.length} defect(s)` : '🟢 No defects'}
        </span>
      </div>
      
      {/* Image */}
      <div className="flex-1 relative">
        {imageUrl ? (
          <ImageWithBBox 
            src={imageUrl}
            objects={objects}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-indusia-textMuted">
            No image
          </div>
        )}
      </div>
      
      {/* Defect List */}
      {hasDefects && (
        <div className="p-2 border-t border-indusia-border max-h-24 overflow-y-auto">
          {objects.map((obj, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <span className="text-indusia-text">{obj.name}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded",
                obj.score >= 0.85 ? "bg-green-500/20 text-green-400" :
                obj.score >= 0.70 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {(obj.score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 5: Update LiveViewV3

### File: `components/inspection/LiveViewV3.jsx`

```jsx
'use client'

import { useLiveInspection } from '@/hooks/useLiveInspection'
import LiveHeader from './LiveHeader'
import InspectionStage from './InspectionStage'
import InspectionResult from './InspectionResult'
import OperatorButtons from './OperatorButtons'
import LiveFooter from './LiveFooter'

export default function LiveViewV3({ lineId, workOrder }) {
  const {
    isConnected,
    isReconnecting,
    connectionError,
    reconnect,
    currentInspection,
    inspectionStage,
    hardwareStatus,
    confirmInspection,
    isConfirming,
    lastConfirmation
  } = useLiveInspection(lineId)

  const handleDecision = async (decision) => {
    const result = await confirmInspection(decision)
    if (!result.success) {
      console.error('Confirm failed:', result.error)
    }
  }

  // Determine what to show in main area
  const showInspectionResult = currentInspection && inspectionStage.status === 'ready'

  return (
    <div className="h-screen flex flex-col bg-indusia-bg">
      {/* Header */}
      <LiveHeader 
        lineId={lineId}
        workOrder={workOrder}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        connectionError={connectionError}
        onReconnect={reconnect}
        currentInspection={currentInspection}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Images or Loading */}
        <div className="flex-1 p-4">
          {showInspectionResult ? (
            <InspectionResult inspection={currentInspection} />
          ) : (
            <InspectionStage stage={inspectionStage} />
          )}
        </div>

        {/* Right: Operator Controls */}
        <div className="w-80 p-4 bg-indusia-surface border-l border-indusia-border flex flex-col">
          {/* AI Decision (when available) */}
          {currentInspection && (
            <div className="mb-4 p-4 bg-indusia-bg rounded-lg">
              <h3 className="text-sm text-indusia-textMuted mb-2">AI Decision</h3>
              <div className={cn(
                "text-3xl font-bold",
                currentInspection.decision === 'PASS' 
                  ? "text-green-400" 
                  : "text-red-400"
              )}>
                {currentInspection.decision}
              </div>
            </div>
          )}

          {/* Operator Buttons */}
          <div className="flex-1 flex flex-col justify-center">
            <OperatorButtons
              onGood={() => handleDecision('GOOD')}
              onNG={() => handleDecision('NG')}
              disabled={!showInspectionResult || isConfirming}
              isLoading={isConfirming}
              aiDecision={currentInspection?.decision}
            />
          </div>

          {/* Hardware Status */}
          <div className="mt-auto pt-4 border-t border-indusia-border">
            <HardwareStatusMini status={hardwareStatus} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <LiveFooter 
        workOrder={workOrder}
        lastConfirmation={lastConfirmation}
      />
    </div>
  )
}
```

---

## Verification Checklist

### Hook Updates
- [ ] `useLiveInspection` handles `running_status` event
- [ ] `useLiveInspection` handles `confirmed` event
- [ ] New `inspectionStage` state added
- [ ] Stage-to-message mapping implemented

### Components
- [ ] `InspectionStage` shows loading animation
- [ ] `InspectionStage` shows progress bar
- [ ] `InspectionResult` displays TOP + BOTTOM side by side
- [ ] `SidePanel` renders image with bbox overlay
- [ ] `SidePanel` shows defect list per side
- [ ] `AIDecisionPanel` shows overall decision

### LiveViewV3
- [ ] Switches between loading and result states
- [ ] GOOD/NG buttons disabled during loading
- [ ] Resets to idle after confirmation

### Styling
- [ ] ISA-101 compliant colors (gray background, color for abnormal)
- [ ] 30mm minimum button size for GOOD/NG
- [ ] Loading animations are subtle (not distracting)
- [ ] Progress bar visible and clear

---

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Board incoming | Show "Capturing TOP side..." animation |
| Both sides captured | Show both images side by side |
| PASS board | Green decision, 0 defects on both sides |
| FAIL top only | Red decision, defects on TOP panel only |
| FAIL bottom only | Red decision, defects on BOTTOM panel only |
| FAIL both sides | Red decision, defects on both panels |
| Operator clicks GOOD | Reset to waiting, next board cycle |
| Operator clicks NG | Reset to waiting, next board cycle |

---

## File Checklist

```
New/Updated Files:
├── hooks/useLiveInspection.js          (update)
├── components/inspection/
│   ├── InspectionStage.jsx             (new)
│   ├── InspectionResult.jsx            (new)
│   ├── SidePanel.jsx                   (new)
│   ├── AIDecisionPanel.jsx             (new)
│   ├── ImageWithBBox.jsx               (update if exists)
│   └── LiveViewV3.jsx                  (update)
└── app/inspection/live/[lineId]/
    └── page.jsx                        (update if needed)
```

'use client';

/**
 * LiveView V2 - Redesigned AOI Inspection Interface
 * 
 * Layout:
 * - Split screen: Defect View (left) + Info Panel (right)
 * - Reference view placeholder (for golden sample comparison)
 * - Board overview mini-map
 * - Action buttons: APPROVE / FALSE CALL / REJECT
 * 
 * PLC Integration:
 * - APPROVE → GOOD signal → Save to DB
 * - REJECT → NG signal → Remove PCB popup → NEXT signal → Save to DB
 * - FALSE CALL → Form → NEXT signal → Save to DB
 * 
 * Development Mode:
 * - SIMULATE NG button to test flow without real camera
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wifi, WifiOff, Clock, User, Package, Pause, Play,
  CheckCircle2, XCircle, Flag, AlertTriangle,
  Volume2, VolumeX, Square, FlaskConical, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/context/SidebarContext';

// Components
import { DefectViewPanel } from './DefectViewPanel';
import { DetectionResultPanel } from './DetectionResultPanel';
import { BoardOverview } from './BoardOverview';
import { FalseCallModal } from './FalseCallModal';
import { NextPCBConfirmModal } from './NextPCBConfirmModal';

// Services
import { signalGood, signalNG, signalNext } from '@/lib/services/plcSignal';
import { saveInspection } from '@/lib/services/inspectionService';
import { getInspectionResult } from '@/lib/services/imageService';

// Fallback mock detection data (used when Supabase not available)
const MOCK_DETECTIONS = [
  {
    class_name: 'solder_bridge',
    confidence: 0.94,
    severity: 'critical',
    component_ref: 'U15',
    pin_number: 'Pin 3-4',
    ipc_reference: 'IPC-A-610 8.2.9',
    bbox: { x: 280, y: 180, width: 80, height: 60 },
  },
  {
    class_name: 'missing_component',
    confidence: 0.89,
    severity: 'critical',
    component_ref: 'C23',
    pin_number: null,
    ipc_reference: 'IPC-A-610 8.3.1',
    bbox: { x: 150, y: 220, width: 60, height: 40 },
  },
  {
    class_name: 'insufficient_solder',
    confidence: 0.76,
    severity: 'major',
    component_ref: 'R47',
    pin_number: 'Pin 1',
    ipc_reference: 'IPC-A-610 8.2.5',
    bbox: { x: 400, y: 120, width: 50, height: 35 },
  },
  {
    class_name: 'tombstone',
    confidence: 0.92,
    severity: 'critical',
    component_ref: 'R12',
    pin_number: null,
    ipc_reference: 'IPC-A-610 8.3.4',
    bbox: { x: 320, y: 300, width: 45, height: 30 },
  },
  {
    class_name: 'cold_solder',
    confidence: 0.81,
    severity: 'major',
    component_ref: 'U8',
    pin_number: 'Pin 12',
    ipc_reference: 'IPC-A-610 8.2.7',
    bbox: { x: 200, y: 150, width: 55, height: 45 },
  },
];

export function LiveViewV2({
  lineId,
  lineName,
  sectionId,
  customerId,
  user,
  onExit,
  isOperator = false,
}) {
  const router = useRouter();
  const { showSidebar } = useSidebar();
  
  // Board ID counter for simulation
  const boardCounterRef = useRef(0);

  // Connection state
  const [connected, setConnected] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Current inspection data
  const [boardId, setBoardId] = useState('---');
  const [batchId, setBatchId] = useState('BATCH-2024-001');
  const [currentImage, setCurrentImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 2400, height: 1792 });
  
  // Multi-defect state
  const [defects, setDefects] = useState([]);
  const [currentDefectIndex, setCurrentDefectIndex] = useState(0);
  const currentDefect = defects[currentDefectIndex] || null;
  
  const [aiResult, setAiResult] = useState('PASS'); // Start in PASS state, waiting for NG

  // Timer
  const [waitTime, setWaitTime] = useState(0);
  const timerRef = useRef(null);
  const inspectionStartTime = useRef(Date.now());

  // Stats - loaded from API
  const [stats, setStats] = useState({
    passed: 0,
    failed: 0,
    falseCall: 0,
  });
  const [currentShift, setCurrentShift] = useState('');

  // Modal states
  const [showFalseCallModal, setShowFalseCallModal] = useState(false);
  const [showNextPCBConfirm, setShowNextPCBConfirm] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  // Audio
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Real-time clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load inspection stats from database on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoadingStats(true);
        const response = await fetch(`/api/inspection/stats/${lineId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          const { stats: apiStats, nextBoardNumber, shift } = result.data;
          
          // Update stats from database
          setStats({
            passed: apiStats.passed || 0,
            failed: apiStats.failed || 0,
            falseCall: apiStats.falseCall || 0,
          });
          
          // Set board counter for next board generation
          boardCounterRef.current = nextBoardNumber || 1;
          
          // Update shift display
          setCurrentShift(shift);
          
          console.log('[LiveView] Loaded stats:', { 
            passed: apiStats.passed, 
            failed: apiStats.failed,
            nextBoard: nextBoardNumber,
            shift 
          });
        }
      } catch (error) {
        console.error('Failed to load inspection stats:', error);
        // Keep default values (0) on error
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    if (lineId) {
      loadStats();
    }
  }, [lineId]);

  // Wait timer (when NG detected and waiting for operator)
  useEffect(() => {
    if (aiResult === 'FAIL' && !isPaused) {
      inspectionStartTime.current = Date.now();
      timerRef.current = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [aiResult, isPaused]);

  // Format wait time
  const formatWaitTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer color based on wait time
  const getTimerColor = () => {
    if (waitTime < 30) return 'text-text-secondary';
    if (waitTime < 60) return 'text-phosphor-amber';
    return 'text-phosphor-red animate-pulse';
  };

  // Calculate yield
  const totalInspected = stats.passed + stats.failed;
  const yieldPercent = totalInspected > 0 
    ? ((stats.passed / totalInspected) * 100).toFixed(1) 
    : '0.0';

  // Calculate cycle time
  const getCycleTimeMs = () => {
    return Date.now() - inspectionStartTime.current;
  };

  // Get current shift
  const getCurrentShift = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'day';
    if (hour >= 14 && hour < 22) return 'swing';
    return 'night';
  };

  // ============ ACTION HANDLERS ============

  // Reset for next board (waiting for AI)
  const resetForNextBoard = useCallback(() => {
    setWaitTime(0);
    setDefects([]);
    setCurrentDefectIndex(0);
    setCurrentImage(null);
    setAiResult('PASS');
    setLastAction(null);
    inspectionStartTime.current = Date.now();
    // In real implementation, wait for next NG from camera/AI
  }, []);

  // Defect navigation handlers
  const handlePrevDefect = useCallback(() => {
    if (currentDefectIndex > 0) {
      setCurrentDefectIndex(prev => prev - 1);
    }
  }, [currentDefectIndex]);

  const handleNextDefect = useCallback(() => {
    if (currentDefectIndex < defects.length - 1) {
      // Mark current as reviewed before moving
      setDefects(prev => prev.map((d, i) => 
        i === currentDefectIndex ? { ...d, reviewed: true } : d
      ));
      setCurrentDefectIndex(prev => prev + 1);
    }
  }, [currentDefectIndex, defects.length]);

  // Jump to specific defect (from BoardOverview click)
  const handleDefectSelect = useCallback((index) => {
    if (index >= 0 && index < defects.length) {
      setCurrentDefectIndex(index);
    }
  }, [defects.length]);

  // SIMULATE NG - For development/testing (loads from Supabase Storage)
  const simulateNG = useCallback(async () => {
    if (aiResult === 'FAIL' || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Generate new board ID
      boardCounterRef.current += 1;
      const newBoardId = `PCB-2024-${String(boardCounterRef.current).padStart(4, '0')}`;
      setBoardId(newBoardId);
      
      // Get inspection result with multiple defects
      const result = await getInspectionResult();
      
      if (result?.imageUrl && result?.defects?.length > 0) {
        setCurrentImage(result.imageUrl);
        setImageSize({ width: result.imageWidth, height: result.imageHeight });
        setDefects(result.defects);
        setCurrentDefectIndex(0);
        
        console.log('[DEV] Inspection result:', { 
          boardId: newBoardId, 
          image: result.imagePath,
          defectCount: result.defects.length,
          defects: result.defects.map(d => `${d.class_name}@${d.component_ref}`)
        });
      } else {
        // Fallback to single mock defect
        const randomDetection = MOCK_DETECTIONS[Math.floor(Math.random() * MOCK_DETECTIONS.length)];
        setDefects([{ ...randomDetection, id: 1, reviewed: false }]);
        setCurrentDefectIndex(0);
        setCurrentImage('/images/sample-pcb.svg');
        console.log('[DEV] Using mock data:', { boardId: newBoardId, defect: randomDetection.class_name });
      }
      
      // Set to FAIL
      setAiResult('FAIL');
      setWaitTime(0);
      inspectionStartTime.current = Date.now();
      
    } catch (error) {
      console.error('[DEV] SimulateNG error:', error);
      // Fallback to mock on error
      const randomDetection = MOCK_DETECTIONS[Math.floor(Math.random() * MOCK_DETECTIONS.length)];
      setDefects([{ ...randomDetection, id: 1, reviewed: false }]);
      setCurrentDefectIndex(0);
      setCurrentImage('/images/sample-pcb.svg');
      setAiResult('FAIL');
      setWaitTime(0);
      inspectionStartTime.current = Date.now();
    } finally {
      setIsProcessing(false);
    }
  }, [aiResult, isProcessing]);

  // Build defects array for database save
  const buildDefectsArray = useCallback((defectsList, disposition = null, falseCallData = null) => {
    if (!defectsList || defectsList.length === 0) return [];
    
    return defectsList.map(det => ({
      defectType: det.class_name,
      severity: det.severity,
      confidence: det.confidence,
      bbox: det.bbox,
      componentRef: det.component_ref,
      pinNumber: det.pin_number,
      operatorDisposition: disposition,
      falseCallNotes: falseCallData?.notes,
    }));
  }, []);

  // APPROVE - AI wrong, board is good (applies to entire board)
  const handleApprove = useCallback(async () => {
    if (!isOperator || isProcessing) return;
    
    setIsProcessing(true);
    setLastAction('APPROVE');
    
    try {
      // 1. Send GOOD signal to PLC
      await signalGood(lineId, boardId, user?.id);
      
      // 2. Save to database (all defects marked as FALSE_CALL)
      const avgConfidence = defects.length > 0 
        ? defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length 
        : 0;
      
      const inspectionData = {
        boardId,
        batchId,
        lineId,
        sectionId,
        customerId,
        aiResult: 'FAIL', // AI said FAIL
        aiConfidence: avgConfidence,
        operatorDecision: 'APPROVE', // Operator says board is good
        operatorId: user?.id,
        plcSignalSent: 'GOOD',
        cycleTimeMs: getCycleTimeMs(),
        shift: getCurrentShift(),
        defects: buildDefectsArray(defects, 'FALSE_CALL'),
        defectCount: defects.length,
        imageFullPath: currentImage, // Save image path for history
      };
      
      const saveResult = await saveInspection(inspectionData);
      if (!saveResult.success) {
        console.error('Failed to save inspection:', saveResult.error);
      }
      
      // 3. Update stats
      setStats(prev => ({ ...prev, passed: prev.passed + 1 }));
      
      console.log('Inspection approved:', { 
        boardId, 
        defectCount: defects.length,
        inspectionId: saveResult.data?.id 
      });
      
      // 4. Reset for next board
      setTimeout(resetForNextBoard, 500);
      
    } catch (error) {
      console.error('Approve error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isOperator, isProcessing, lineId, boardId, batchId, sectionId, customerId, 
      user, defects, buildDefectsArray, resetForNextBoard]);

  // REJECT - Confirm defect (applies to entire board)
  const handleReject = useCallback(async () => {
    if (!isOperator || isProcessing) return;
    
    setIsProcessing(true);
    setLastAction('REJECT');
    
    try {
      // 1. Send NG signal to PLC immediately
      await signalNG(lineId, boardId, user?.id);
      
      // 2. Save to database (all defects marked as TRUE_DEFECT)
      const avgConfidence = defects.length > 0 
        ? defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length 
        : 0;
      
      const inspectionData = {
        boardId,
        batchId,
        lineId,
        sectionId,
        customerId,
        aiResult: 'FAIL',
        aiConfidence: avgConfidence,
        operatorDecision: 'REJECT',
        operatorId: user?.id,
        plcSignalSent: 'NG',
        cycleTimeMs: getCycleTimeMs(),
        shift: getCurrentShift(),
        defects: buildDefectsArray(defects, 'TRUE_DEFECT'),
        defectCount: defects.length,
        imageFullPath: currentImage, // Save image path for history
      };
      
      const saveResult = await saveInspection(inspectionData);
      if (!saveResult.success) {
        console.error('Failed to save inspection:', saveResult.error);
      }
      
      // 3. Update stats
      setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      
      console.log('Inspection rejected:', { 
        boardId, 
        defectCount: defects.length,
        inspectionId: saveResult.data?.id 
      });
      
      // 4. Show "Remove PCB" confirmation
      setShowNextPCBConfirm(true);
      
    } catch (error) {
      console.error('Reject error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isOperator, isProcessing, lineId, boardId, batchId, sectionId, customerId, 
      user, defects, buildDefectsArray]);

  // Handle Next PCB confirmation (after reject)
  const handleNextPCBConfirm = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      // Send NEXT signal to PLC
      await signalNext(lineId, boardId, user?.id, 'reject_removed');
      
      setShowNextPCBConfirm(false);
      
      // Reset for next board
      setTimeout(resetForNextBoard, 500);
      
    } catch (error) {
      console.error('Next PCB error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [lineId, boardId, user, resetForNextBoard]);

  // FALSE CALL - Report AI error
  const handleFalseCall = useCallback(() => {
    if (!isOperator) return;
    setShowFalseCallModal(true);
  }, [isOperator]);

  // Handle False Call submit
  const handleFalseCallSubmit = useCallback(async (formData) => {
    setIsProcessing(true);
    setLastAction('FALSE_CALL');
    
    try {
      // 1. Save to database with false call data
      const avgConfidence = defects.length > 0 
        ? defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length 
        : 0;
      
      const inspectionData = {
        boardId,
        batchId,
        lineId,
        sectionId,
        customerId,
        aiResult: 'FAIL',
        aiConfidence: avgConfidence,
        operatorDecision: 'FALSE_CALL',
        operatorId: user?.id,
        plcSignalSent: 'NEXT',
        cycleTimeMs: getCycleTimeMs(),
        shift: getCurrentShift(),
        defects: buildDefectsArray(defects, 'FALSE_CALL', formData),
        defectCount: defects.length,
        falseCallReasonCode: formData.reason, // e.g., 'REFLECTION'
        imageFullPath: currentImage, // Save image path for history
      };
      
      const saveResult = await saveInspection(inspectionData);
      if (!saveResult.success) {
        console.error('Failed to save inspection:', saveResult.error);
      }
      
      console.log('False call reported:', { 
        boardId, 
        reason: formData.reason, 
        defectCount: defects.length,
        inspectionId: saveResult.data?.id 
      });

      // 2. Add to sync queue for training data upload
      try {
        const syncQueueData = {
          inspectionId: saveResult.data?.id,
          boardId,
          customerName: null, // TODO: get from context
          sectionName: null,
          lineName: lineName || `Line ${lineId}`,
          defectType: defects[0]?.class_name || 'unknown',
          defectCount: defects.length,
          localImagePath: currentImage, // e.g., '/images/pcb_solder_bridge_01.png'
          recordType: 'false_call',
        };
        
        await fetch('/api/sync-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncQueueData),
        });
        
        console.log('Added to sync queue:', boardId);
      } catch (syncError) {
        console.error('Failed to add to sync queue:', syncError);
        // Don't fail the whole operation if sync queue fails
      }
      
      // 3. Update stats
      setStats(prev => ({ 
        ...prev, 
        passed: prev.passed + 1,
        falseCall: prev.falseCall + 1 
      }));
      
      // 4. Send NEXT signal to PLC
      await signalNext(lineId, boardId, user?.id, formData.reason);
      
      setShowFalseCallModal(false);
      
      // 5. Reset for next board
      setTimeout(resetForNextBoard, 500);
      
    } catch (error) {
      console.error('False call error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [lineId, lineName, boardId, batchId, sectionId, customerId, user, defects, currentImage, buildDefectsArray, resetForNextBoard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Simulate NG with 'N' key when in PASS state
      if (e.key.toLowerCase() === 'n' && aiResult === 'PASS' && !isProcessing) {
        simulateNG();
        return;
      }
      
      if (!isOperator || isProcessing || showFalseCallModal || showNextPCBConfirm) return;
      if (aiResult !== 'FAIL') return;
      
      switch (e.key.toLowerCase()) {
        case 'a':
          handleApprove();
          break;
        case 'f':
          handleFalseCall();
          break;
        case 'r':
          handleReject();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        // Defect navigation
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          handlePrevDefect();
          break;
        case 'arrowright':
        case 'k':
          e.preventDefault();
          handleNextDefect();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOperator, isProcessing, showFalseCallModal, showNextPCBConfirm, aiResult, 
      handleApprove, handleFalseCall, handleReject, simulateNG, handlePrevDefect, handleNextDefect]);

  // Determine if actions should be disabled
  const actionsDisabled = !isOperator || isProcessing || isPaused || !connected || aiResult !== 'FAIL';

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* ============ HEADER ============ */}
      <header className="h-14 flex-shrink-0 bg-panel border-b border-surface-border flex items-center justify-between px-4">
        {/* Left: Menu + Logo + Line Info */}
        <div className="flex items-center gap-4">
          {/* Hamburger Menu - Opens shared SideNav */}
          <button
            onClick={showSidebar}
            className="p-2 border border-surface-border text-text-secondary hover:border-phosphor-amber/50 hover:text-phosphor-amber transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo + Line Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-phosphor-amber flex items-center justify-center bg-terminal">
              <span className="font-display font-bold text-lg text-phosphor-amber">IN</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-wider text-text-primary">
                {lineName || `Line ${lineId}`}
              </h1>
              <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
                LIVE INSPECTION
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            connected 
              ? "border-phosphor-green/50 bg-phosphor-green/10" 
              : "border-phosphor-red/50 bg-phosphor-red/10"
          )}>
            {connected ? (
              <Wifi className="w-4 h-4 text-phosphor-green" />
            ) : (
              <WifiOff className="w-4 h-4 text-phosphor-red" />
            )}
            <span className={cn(
              "font-mono text-xs font-bold",
              connected ? "text-phosphor-green" : "text-phosphor-red"
            )}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        {/* Center: Board Info + Status */}
        <div className="flex items-center gap-4">
          {/* Board ID */}
          <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
            <Package className="w-4 h-4 text-text-tertiary" />
            <div>
              <p className="font-mono text-xxs text-text-tertiary">BOARD</p>
              <p className="font-mono text-sm font-bold text-phosphor-cyan">{boardId}</p>
            </div>
          </div>

          {/* AI Result Status */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 border",
            aiResult === 'FAIL' 
              ? "bg-phosphor-red/10 border-phosphor-red/50" 
              : "bg-phosphor-green/10 border-phosphor-green/50"
          )}>
            {aiResult === 'FAIL' ? (
              <AlertTriangle className="w-5 h-5 text-phosphor-red" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-phosphor-green" />
            )}
            <span className={cn(
              "font-display font-bold text-sm tracking-wider",
              aiResult === 'FAIL' ? "text-phosphor-red" : "text-phosphor-green"
            )}>
              {aiResult === 'FAIL' ? 'NG DETECTED' : 'PASS'}
            </span>
          </div>

          {/* Wait Timer (only show when NG) */}
          {aiResult === 'FAIL' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-terminal border border-surface-border">
              <Clock className={cn("w-4 h-4", getTimerColor())} />
              <span className={cn("font-mono text-lg font-bold", getTimerColor())}>
                {formatWaitTime(waitTime)}
              </span>
            </div>
          )}
        </div>

        {/* Right: User + Time + Controls */}
        <div className="flex items-center gap-4">
          {/* View Only Badge */}
          {!isOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 border border-phosphor-cyan/30">
              <span className="font-mono text-xs font-bold text-phosphor-cyan">VIEW ONLY</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2 border transition-colors",
              soundEnabled 
                ? "border-phosphor-amber text-phosphor-amber" 
                : "border-surface-border text-text-tertiary"
            )}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Time */}
          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>

          {/* User */}
          <div className="flex items-center gap-2 px-3 py-2 bg-terminal border border-surface-border">
            <User className="w-4 h-4 text-text-tertiary" />
            <span className="font-mono text-xs text-text-primary">{user?.name || 'Unknown'}</span>
          </div>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Defect View + Reference (60%) */}
        <div className="w-[60%] flex flex-col p-3 gap-3">
          {/* Defect View (larger) */}
          <div className="flex-[2] flex flex-col">
            <DefectViewPanel
              imageSrc={currentImage}
              detection={currentDefect}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              title="DEFECT VIEW"
              className="flex-1"
            />
            
            {/* Defect Navigation Bar */}
            {defects.length > 0 && (
              <div className="flex items-center justify-center gap-4 py-2 bg-panel border border-t-0 border-surface-border">
                <button
                  onClick={handlePrevDefect}
                  disabled={currentDefectIndex === 0}
                  className={cn(
                    "px-4 py-2 border font-mono text-sm transition-colors",
                    currentDefectIndex === 0
                      ? "border-surface-border text-text-tertiary cursor-not-allowed opacity-50"
                      : "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber/10"
                  )}
                >
                  ◄ PREV (J)
                </button>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
                  <span className="font-mono text-sm text-text-tertiary">DEFECT</span>
                  <span className="font-mono text-lg font-bold text-phosphor-amber">
                    {currentDefectIndex + 1}
                  </span>
                  <span className="font-mono text-sm text-text-tertiary">of</span>
                  <span className="font-mono text-lg font-bold text-phosphor-amber">
                    {defects.length}
                  </span>
                </div>
                
                <button
                  onClick={handleNextDefect}
                  disabled={currentDefectIndex === defects.length - 1}
                  className={cn(
                    "px-4 py-2 border font-mono text-sm transition-colors",
                    currentDefectIndex === defects.length - 1
                      ? "border-surface-border text-text-tertiary cursor-not-allowed opacity-50"
                      : "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber/10"
                  )}
                >
                  NEXT (K) ►
                </button>
              </div>
            )}
          </div>

          {/* Reference View - HIDDEN (Coming Soon)
          <div className="flex-1 bg-terminal border border-surface-border flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 bg-void border-b border-surface-border">
              <span className="font-mono text-xs text-text-tertiary">REFERENCE VIEW</span>
              <span className="px-2 py-0.5 bg-phosphor-amber/10 border border-phosphor-amber/30 font-mono text-xxs text-phosphor-amber">
                COMING SOON
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-xs text-text-tertiary">
                Golden sample comparison not yet configured
              </p>
            </div>
          </div>
          */}
        </div>

        {/* Right Panel: Detection Info + Overview + Actions (40%) */}
        <div className="w-[40%] flex flex-col p-3 pl-0 gap-3">
          {/* Detection Result Panel */}
          <div className="flex-[2]">
            <DetectionResultPanel
              detection={currentDefect}
              aiResult={aiResult}
              defectIndex={currentDefectIndex}
              defectCount={defects.length}
              className="h-full"
            />
          </div>

          {/* Board Overview Mini-map */}
          <div className="flex-1">
            <BoardOverview
              imageSrc={currentImage}
              defects={defects}
              currentDefectIndex={currentDefectIndex}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              onDefectSelect={handleDefectSelect}
              className="h-full"
            />
          </div>
        </div>
      </main>

      {/* ============ FOOTER: ACTIONS ============ */}
      <footer className="h-24 flex-shrink-0 bg-panel border-t border-surface-border flex items-center justify-between px-4">
        {/* Left: Stats + Shift */}
        <div className="flex items-center gap-4">
          {/* Shift Indicator */}
          {currentShift && (
            <div className="flex flex-col items-center px-3 py-1 bg-terminal border border-surface-border">
              <span className="font-mono text-xxs text-text-tertiary">SHIFT</span>
              <span className={cn(
                "font-display text-sm font-bold tracking-wider",
                currentShift === 'day' && 'text-phosphor-amber',
                currentShift === 'swing' && 'text-phosphor-cyan',
                currentShift === 'night' && 'text-indigo-400'
              )}>
                {currentShift.toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Stats */}
          <div className="flex items-center gap-6 px-4 py-2 bg-terminal border border-surface-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-phosphor-green" />
              <span className="font-mono text-xl font-bold text-phosphor-green">{stats.passed}</span>
              <span className="font-mono text-xs text-text-tertiary">PASS</span>
            </div>
            <div className="w-px h-8 bg-surface-border" />
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-phosphor-red" />
              <span className="font-mono text-xl font-bold text-phosphor-red">{stats.failed}</span>
              <span className="font-mono text-xs text-text-tertiary">FAIL</span>
            </div>
            <div className="w-px h-8 bg-surface-border" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-text-tertiary">YIELD</span>
              <span className={cn(
                "font-mono text-xl font-bold",
                parseFloat(yieldPercent) >= 98 ? "text-phosphor-green" : 
                parseFloat(yieldPercent) >= 95 ? "text-phosphor-amber" : "text-phosphor-red"
              )}>
                {yieldPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center gap-4">
          {/* SIMULATE NG - Only shown when PASS (Dev mode) */}
          {aiResult === 'PASS' && (
            <button
              onClick={simulateNG}
              disabled={isProcessing}
              className={cn(
                "h-16 px-6 flex items-center gap-3 border-2 transition-all",
                "font-display text-lg font-bold tracking-wider",
                "bg-phosphor-cyan/10 border-phosphor-cyan text-phosphor-cyan",
                "hover:bg-phosphor-cyan hover:text-void hover:shadow-glow-cyan",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <FlaskConical className="w-6 h-6" />
              <span>SIMULATE NG</span>
              <span className="font-mono text-xs opacity-60">(N)</span>
            </button>
          )}

          {/* APPROVE */}
          <button
            onClick={handleApprove}
            disabled={actionsDisabled}
            className={cn(
              "h-16 px-8 flex items-center gap-3 border-2 transition-all",
              "font-display text-lg font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : "bg-phosphor-green/10 border-phosphor-green text-phosphor-green hover:bg-phosphor-green hover:text-void hover:shadow-glow-green"
            )}
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>APPROVE</span>
            <span className="font-mono text-xs opacity-60">(A)</span>
          </button>

          {/* FALSE CALL */}
          <button
            onClick={handleFalseCall}
            disabled={actionsDisabled}
            className={cn(
              "h-16 px-8 flex items-center gap-3 border-2 transition-all",
              "font-display text-lg font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : "bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber hover:text-void hover:shadow-glow-amber"
            )}
          >
            <Flag className="w-6 h-6" />
            <span>FALSE CALL</span>
            <span className="font-mono text-xs opacity-60">(F)</span>
          </button>

          {/* REJECT */}
          <button
            onClick={handleReject}
            disabled={actionsDisabled}
            className={cn(
              "h-16 px-10 flex items-center gap-3 border-2 transition-all",
              "font-display text-lg font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : "bg-phosphor-red/10 border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void hover:shadow-glow-red"
            )}
          >
            <XCircle className="w-6 h-6" />
            <span>REJECT</span>
            <span className="font-mono text-xs opacity-60">(R)</span>
          </button>
        </div>

        {/* Right: Pause + Stop */}
        <div className="flex items-center gap-3">
          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            disabled={!isOperator}
            className={cn(
              "h-12 px-4 flex items-center gap-2 border transition-colors",
              "font-display text-sm font-bold tracking-wider",
              isPaused
                ? "bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber"
                : "border-surface-border text-text-secondary hover:border-phosphor-amber/50",
              !isOperator && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Stop/Exit */}
          <button
            onClick={onExit}
            className={cn(
              "h-12 px-6 flex items-center gap-2 transition-colors",
              "font-display text-sm font-bold tracking-wider",
              "bg-phosphor-red text-void hover:shadow-glow-red"
            )}
          >
            <Square className="w-4 h-4" />
            <span>{isOperator ? 'STOP' : 'EXIT'}</span>
          </button>
        </div>
      </footer>

      {/* ============ MODALS ============ */}
      
      {/* False Call Modal */}
      <FalseCallModal
        isOpen={showFalseCallModal}
        onClose={() => setShowFalseCallModal(false)}
        onSubmit={handleFalseCallSubmit}
        boardId={boardId}
        defectType={currentDefect?.class_name}
        defectCount={defects.length}
        isProcessing={isProcessing}
      />

      {/* Next PCB Confirmation Modal (after reject) */}
      <NextPCBConfirmModal
        isOpen={showNextPCBConfirm}
        boardId={boardId}
        onConfirm={handleNextPCBConfirm}
        isProcessing={isProcessing}
      />
    </div>
  );
}

export default LiveViewV2;

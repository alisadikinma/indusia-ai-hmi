/**
 * LiveView V3 - Work Order Integrated AOI Inspection Interface
 * 
 * Changes from V2:
 * - Work Order integration (load active WO, update counters)
 * - 2-button flow: APPROVE / FALSE CALL (removed REJECT)
 * - Side tracking: TOP / BOTTOM for 2-sided PCB
 * - 15-second GOOD auto-proceed
 * - Updated YIELD calculation based on WO data
 * 
 * Button Logic:
 * - APPROVE: AI detection is CORRECT
 *   - For GOOD detection: Confirm board is good → good_qty++
 *   - For NG detection: Confirm defect is real → ng_qty++
 * - FALSE CALL: AI detection is WRONG (requires reason)
 *   - For NG detection: Board is actually good → good_qty++, false_call_qty++
 * 
 * Side Logic:
 * - If side_count=2 and current_side=TOP → FLIP_BOTTOM → inspect BOTTOM
 * - If side_count=1 OR current_side=BOTTOM → NEXT_PCB → completed_qty++
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wifi, WifiOff, Clock, User, Package, Pause, Play,
  CheckCircle2, XCircle, Flag, AlertTriangle,
  Volume2, VolumeX, Square, FlaskConical, Menu,
  RotateCcw, ArrowRight, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/context/SidebarContext';
import { useActiveWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders';

// Components
import { DefectViewPanel } from './DefectViewPanel';
import { DetectionResultPanel } from './DetectionResultPanel';
import { BoardOverview } from './BoardOverview';
import { FalseCallModal } from './FalseCallModal';

// Services
import { 
  signalGood, 
  signalNG, 
  signalFlipBottom, 
  signalNextPCB,
  determinePLCSignal 
} from '@/lib/services/plcSignal';
import { saveInspection } from '@/lib/services/inspectionService';
import { getInspectionResult } from '@/lib/services/imageService';
import { cropAndSaveAllDefects } from '@/lib/utils/cropImage';

// Constants
const GOOD_AUTO_PROCEED_SECONDS = 15;
const DEV_MODE = true; // Set to false in production to hide SIM buttons

// Fallback mock detection data
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
];

export function LiveViewV3({
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
  
  // Work Order hooks
  const { workOrder, hasActiveWO, loading: woLoading, refresh: refreshWO } = useActiveWorkOrder(lineId);
  const { updateCounters } = useWorkOrderMutations();

  // Board sequence counter
  const boardSequenceRef = useRef(1);

  // Connection state
  const [connected, setConnected] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Current inspection data
  const [boardId, setBoardId] = useState('---');
  const [currentImage, setCurrentImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 2400, height: 1792 });
  
  // Side tracking
  const [currentSide, setCurrentSide] = useState('TOP'); // 'TOP' or 'BOTTOM'
  
  // Multi-defect state
  const [defects, setDefects] = useState([]);
  const [currentDefectIndex, setCurrentDefectIndex] = useState(0);
  const currentDefect = defects[currentDefectIndex] || null;
  
  // AI Result: 'WAITING' | 'GOOD' | 'NG'
  const [aiResult, setAiResult] = useState('WAITING');

  // Timer states
  const [waitTime, setWaitTime] = useState(0);
  const [goodCountdown, setGoodCountdown] = useState(GOOD_AUTO_PROCEED_SECONDS);
  const timerRef = useRef(null);
  const goodTimerRef = useRef(null);
  const inspectionStartTime = useRef(Date.now());

  // Modal states
  const [showFalseCallModal, setShowFalseCallModal] = useState(false);
  const [showFlipNotice, setShowFlipNotice] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  // Audio
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Track inspection count for alternating pattern
  const inspectionCountRef = useRef(0);
  
  // Track if initial load done
  const initialLoadDone = useRef(false);

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

  // NG Wait timer
  useEffect(() => {
    if (aiResult === 'NG' && !isPaused) {
      inspectionStartTime.current = Date.now();
      timerRef.current = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [aiResult, isPaused]);

  // GOOD auto-proceed countdown
  useEffect(() => {
    if (aiResult === 'GOOD' && !isPaused && isOperator) {
      setGoodCountdown(GOOD_AUTO_PROCEED_SECONDS);
      
      goodTimerRef.current = setInterval(() => {
        setGoodCountdown(prev => {
          if (prev <= 1) {
            // Auto-proceed
            handleApproveGood();
            return GOOD_AUTO_PROCEED_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (goodTimerRef.current) clearInterval(goodTimerRef.current);
    };
  }, [aiResult, isPaused, isOperator]);

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

  // Calculate yield from WO data
  const yieldPercent = workOrder?.completedQty > 0 
    ? ((workOrder.goodQty / workOrder.completedQty) * 100).toFixed(1) 
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

  // ============ AUTO-LOAD INSPECTION ============
  
  /**
   * Load next inspection - simulates camera capture + AI detection
   * In production: this would be triggered by camera/conveyor signal
   * For demo: auto-loads random GOOD/NG result
   */
  const loadNextInspection = useCallback(async (side = 'TOP') => {
    console.log('[LiveView] loadNextInspection called:', { side, hasWO: !!workOrder, isProcessing, isPaused });
    
    if (!workOrder || isProcessing || isPaused) {
      console.log('[LiveView] loadNextInspection skipped - conditions not met');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const newBoardId = `${workOrder.woNumber}-${String(boardSequenceRef.current).padStart(4, '0')}`;
      setBoardId(newBoardId);
      
      // Increment inspection counter
      inspectionCountRef.current += 1;
      const inspCount = inspectionCountRef.current;
      
      // Pattern: NG on every 2nd and 5th inspection in cycle of 6
      const ngPattern = [2, 5];
      const cyclePosition = ((inspCount - 1) % 6) + 1;
      const isGood = !ngPattern.includes(cyclePosition);
      
      console.log('[LiveView] loadNextInspection pattern:', { inspCount, cyclePosition, isGood });
      
      // Get inspection result from imageService
      const result = await getInspectionResult({ 
        side, 
        result: isGood ? 'GOOD' : 'NG' 
      });
      
      if (result) {
        setCurrentImage(result.imageUrl);
        setImageSize({ width: result.imageWidth, height: result.imageHeight });
        
        if (result.isGood || result.defects.length === 0) {
          setAiResult('GOOD');
          setDefects([]);
          setCurrentDefectIndex(0);
        } else {
          setAiResult('NG');
          setDefects(result.defects);
          setCurrentDefectIndex(0);
          setWaitTime(0);
        }
      } else {
        // Fallback to GOOD
        setCurrentImage('/images/pcb_golden_TOP.png');
        setImageSize({ width: 1024, height: 768 });
        setAiResult('GOOD');
        setDefects([]);
      }
      
      inspectionStartTime.current = Date.now();
      console.log('[LiveView] loadNextInspection complete:', { boardId: newBoardId, result: isGood ? 'GOOD' : 'NG' });
      
    } catch (error) {
      console.error('[LiveView] Load inspection error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [workOrder, isProcessing, isPaused]);

  // Auto-load first inspection when workOrder is ready
  useEffect(() => {
    console.log('[LiveView] Auto-load check:', { 
      hasWO: !!workOrder, 
      woLoading, 
      initialLoadDone: initialLoadDone.current,
      isPaused 
    });
    
    // Skip if already loaded or conditions not met
    if (!workOrder || woLoading || initialLoadDone.current || isPaused) {
      return;
    }
    
    console.log('[LiveView] Starting initial load NOW');
    initialLoadDone.current = true;
    
    // Immediately invoke async function
    (async () => {
      console.log('[LiveView] Async function executing');
      setIsProcessing(true);
      
      try {
        const newBoardId = `${workOrder.woNumber}-${String(boardSequenceRef.current).padStart(4, '0')}`;
        console.log('[LiveView] Generated boardId:', newBoardId);
        setBoardId(newBoardId);
        
        // Increment inspection counter
        inspectionCountRef.current += 1;
        const inspCount = inspectionCountRef.current;
        
        // Pattern: NG on every 2nd and 5th inspection in cycle of 6
        // Gives roughly 33% NG rate with predictable pattern for demo
        const ngPattern = [2, 5]; // NG on 2nd and 5th
        const cyclePosition = ((inspCount - 1) % 6) + 1; // 1-6
        const isGood = !ngPattern.includes(cyclePosition);
        
        console.log('[LiveView] Inspection pattern:', { 
          inspCount, 
          cyclePosition, 
          isGood,
          pattern: 'NG on positions 2,5 of every 6'
        });
        
        const result = await getInspectionResult({ side: currentSide, result: isGood ? 'GOOD' : 'NG' });
        console.log('[LiveView] getInspectionResult returned:', result);
        
        if (result) {
          console.log('[LiveView] Setting image:', result.imageUrl);
          setCurrentImage(result.imageUrl);
          setImageSize({ width: result.imageWidth, height: result.imageHeight });
          
          if (result.isGood || result.defects.length === 0) {
            setAiResult('GOOD');
            setDefects([]);
          } else {
            setAiResult('NG');
            setDefects(result.defects);
            setCurrentDefectIndex(0);
            setWaitTime(0);
          }
        } else {
          console.log('[LiveView] No result, using fallback');
          setCurrentImage('/images/pcb_golden_TOP.png');
          setImageSize({ width: 1024, height: 768 });
          setAiResult('GOOD');
          setDefects([]);
        }
        
        inspectionStartTime.current = Date.now();
        console.log('[LiveView] Initial load COMPLETE');
        
      } catch (error) {
        console.error('[LiveView] Initial load error:', error);
      } finally {
        setIsProcessing(false);
      }
    })();
    
  }, [workOrder, woLoading, isPaused, currentSide]);

  // ============ SIDE LOGIC ============

  const handleSideComplete = useCallback(async (result) => {
    if (!workOrder) return;

    const sideCount = workOrder.sideCount || 1;
    const { signal, nextSide } = determinePLCSignal(sideCount, currentSide, result);

    if (signal === 'FLIP_BOTTOM') {
      // Need to inspect bottom side
      await signalFlipBottom(lineId, boardId, user?.id);
      setCurrentSide('BOTTOM');
      setShowFlipNotice(true);
      
      // Reset for bottom inspection - pass 'BOTTOM' as next side
      setTimeout(() => {
        setShowFlipNotice(false);
        resetForSameBoard('BOTTOM');
      }, 2000);
      
    } else if (signal === 'NEXT_PCB') {
      // Full cycle complete
      await signalNextPCB(lineId, boardId, user?.id, currentSide, {
        woNumber: workOrder.woNumber,
        boardSequence: boardSequenceRef.current,
      });
      
      // Increment completed qty
      await updateCounters(workOrder.id, { completedQty: 1 });
      
      // Reset for next board
      boardSequenceRef.current += 1;
      setCurrentSide('TOP');
      resetForNextBoard();
      
      // Refresh WO data
      refreshWO();
    }
  }, [workOrder, currentSide, lineId, boardId, user, updateCounters, refreshWO]);

  // Reset for same board (after flip) - then auto-load
  const resetForSameBoard = useCallback((nextSide = 'BOTTOM') => {
    setWaitTime(0);
    setDefects([]);
    setCurrentDefectIndex(0);
    setCurrentImage(null);
    setAiResult('WAITING');
    setLastAction(null);
    inspectionStartTime.current = Date.now();
    
    // Auto-load inspection for the flipped side after short delay
    setTimeout(() => {
      loadNextInspection(nextSide);
    }, 300);
  }, [loadNextInspection]);

  // Reset for next board - then auto-load
  const resetForNextBoard = useCallback(() => {
    setWaitTime(0);
    setDefects([]);
    setCurrentDefectIndex(0);
    setCurrentImage(null);
    setAiResult('WAITING');
    setLastAction(null);
    setBoardId('---');
    inspectionStartTime.current = Date.now();
    
    // Auto-load inspection for next board after short delay
    setTimeout(() => {
      loadNextInspection('TOP');
    }, 300);
  }, [loadNextInspection]);

  // ============ DEFECT NAVIGATION ============

  const handlePrevDefect = useCallback(() => {
    if (currentDefectIndex > 0) {
      setCurrentDefectIndex(prev => prev - 1);
    }
  }, [currentDefectIndex]);

  const handleNextDefect = useCallback(() => {
    if (currentDefectIndex < defects.length - 1) {
      setDefects(prev => prev.map((d, i) => 
        i === currentDefectIndex ? { ...d, reviewed: true } : d
      ));
      setCurrentDefectIndex(prev => prev + 1);
    }
  }, [currentDefectIndex, defects.length]);

  const handleDefectSelect = useCallback((index) => {
    if (index >= 0 && index < defects.length) {
      setCurrentDefectIndex(index);
    }
  }, [defects.length]);

  // ============ SIMULATE ============

  // Simulate GOOD detection
  const simulateGood = useCallback(async () => {
    if (aiResult !== 'WAITING' || isProcessing || !workOrder) return;
    
    setIsProcessing(true);
    
    try {
      const newBoardId = `${workOrder.woNumber}-${String(boardSequenceRef.current).padStart(4, '0')}`;
      setBoardId(newBoardId);
      
      // Get good reference for current side
      const result = await getInspectionResult({ side: currentSide, result: 'GOOD' });
      
      setAiResult('GOOD');
      setDefects([]);
      setCurrentImage(result?.imageUrl || '/images/pcb_golden_TOP.png');
      setImageSize({ width: result?.imageWidth || 1024, height: result?.imageHeight || 768 });
      inspectionStartTime.current = Date.now();
      
      console.log('[DEV] Simulated GOOD:', { boardId: newBoardId, side: currentSide });
      
    } finally {
      setIsProcessing(false);
    }
  }, [aiResult, isProcessing, workOrder, currentSide]);

  // Simulate NG detection
  const simulateNG = useCallback(async () => {
    if (aiResult !== 'WAITING' || isProcessing || !workOrder) return;
    
    setIsProcessing(true);
    
    try {
      const newBoardId = `${workOrder.woNumber}-${String(boardSequenceRef.current).padStart(4, '0')}`;
      setBoardId(newBoardId);
      
      // Get inspection result with defects for current side
      const result = await getInspectionResult({ side: currentSide, result: 'NG' });
      
      if (result?.imageUrl && result?.defects?.length > 0) {
        setCurrentImage(result.imageUrl);
        setImageSize({ width: result.imageWidth, height: result.imageHeight });
        setDefects(result.defects);
        setCurrentDefectIndex(0);
      } else {
        // Fallback to mock
        const randomDetection = MOCK_DETECTIONS[Math.floor(Math.random() * MOCK_DETECTIONS.length)];
        setDefects([{ ...randomDetection, id: 1, reviewed: false }]);
        setCurrentDefectIndex(0);
        setCurrentImage('/images/pcb_golden_TOP.png');
        setImageSize({ width: 1024, height: 768 });
      }
      
      setAiResult('NG');
      setWaitTime(0);
      inspectionStartTime.current = Date.now();
      
      console.log('[DEV] Simulated NG:', { boardId: newBoardId, side: currentSide, defects: result?.defects?.length || 0 });
      
    } catch (error) {
      console.error('[DEV] SimulateNG error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [aiResult, isProcessing, workOrder, currentSide]);

  // ============ ACTION HANDLERS ============

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

  // APPROVE for GOOD detection
  const handleApproveGood = useCallback(async () => {
    if (!isOperator || isProcessing || !workOrder) return;
    if (aiResult !== 'GOOD') return;
    
    setIsProcessing(true);
    setLastAction('APPROVE_GOOD');
    
    // Clear countdown timer
    if (goodTimerRef.current) clearInterval(goodTimerRef.current);
    
    try {
      // 1. Send GOOD signal to PLC
      await signalGood(lineId, boardId, user?.id, currentSide);
      
      // 2. Save to database
      const inspectionData = {
        boardId,
        workOrderId: workOrder.id,
        lineId,
        sectionId,
        customerId,
        side: currentSide,
        boardSequence: boardSequenceRef.current,
        aiResult: 'GOOD',
        aiConfidence: 1.0,
        operatorDecision: 'APPROVE',
        operatorId: user?.id,
        plcSignalSent: 'GOOD',
        cycleTimeMs: getCycleTimeMs(),
        shift: getCurrentShift(),
        defects: [],
        defectCount: 0,
      };
      
      await saveInspection(inspectionData);
      
      // 3. Update WO counters (good_qty++)
      await updateCounters(workOrder.id, { goodQty: 1 });
      
      console.log('GOOD approved:', { boardId, side: currentSide });
      
      // 4. Handle side logic
      await handleSideComplete('GOOD');
      
    } catch (error) {
      console.error('Approve GOOD error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isOperator, isProcessing, workOrder, aiResult, lineId, boardId, currentSide, 
      sectionId, customerId, user, updateCounters, handleSideComplete]);

  // APPROVE for NG detection (confirm defect is real)
  const handleApproveNG = useCallback(async () => {
    if (!isOperator || isProcessing || !workOrder) return;
    if (aiResult !== 'NG') return;
    
    setIsProcessing(true);
    setLastAction('APPROVE_NG');
    
    try {
      // 1. Send NG signal to PLC
      await signalNG(lineId, boardId, user?.id, currentSide);
      
      // 2. Save to database
      const avgConfidence = defects.length > 0 
        ? defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length 
        : 0;
      
      const inspectionData = {
        boardId,
        workOrderId: workOrder.id,
        lineId,
        sectionId,
        customerId,
        side: currentSide,
        boardSequence: boardSequenceRef.current,
        aiResult: 'NG',
        aiConfidence: avgConfidence,
        operatorDecision: 'APPROVE',
        operatorId: user?.id,
        plcSignalSent: 'NG',
        cycleTimeMs: getCycleTimeMs(),
        shift: getCurrentShift(),
        defects: buildDefectsArray(defects, 'TRUE_DEFECT'),
        defectCount: defects.length,
        imageFullPath: currentImage,
      };
      
      await saveInspection(inspectionData);
      
      // 3. Update WO counters (ng_qty++)
      await updateCounters(workOrder.id, { ngQty: 1 });
      
      console.log('NG approved (confirmed defect):', { boardId, side: currentSide, defects: defects.length });
      
      // 4. Handle side logic (NG always goes to NEXT_PCB, board rejected)
      await signalNextPCB(lineId, boardId, user?.id, currentSide, {
        woNumber: workOrder.woNumber,
        boardSequence: boardSequenceRef.current,
      });
      
      // Increment completed qty
      await updateCounters(workOrder.id, { completedQty: 1 });
      
      // Reset for next board
      boardSequenceRef.current += 1;
      setCurrentSide('TOP');
      resetForNextBoard();
      refreshWO();
      
    } catch (error) {
      console.error('Approve NG error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isOperator, isProcessing, workOrder, aiResult, lineId, boardId, currentSide,
      sectionId, customerId, user, defects, currentImage, buildDefectsArray, 
      updateCounters, resetForNextBoard, refreshWO]);

  // FALSE CALL - AI wrong, show modal (works for both NG and GOOD)
  const handleFalseCall = useCallback(() => {
    if (!isOperator || aiResult === 'WAITING') return;
    // Stop auto-proceed countdown if GOOD
    if (goodTimerRef.current) clearInterval(goodTimerRef.current);
    setShowFalseCallModal(true);
  }, [isOperator, aiResult]);

  // FALSE CALL submit - handles both false positive (NG→GOOD) and missed defect (GOOD→NG)
  const handleFalseCallSubmit = useCallback(async (formData) => {
    if (!workOrder) return;
    
    setIsProcessing(true);
    const isMissedDefect = formData.falseCallType === 'MISSED_DEFECT';
    setLastAction(isMissedDefect ? 'MISSED_DEFECT' : 'FALSE_CALL');
    
    try {
      const avgConfidence = defects.length > 0 
        ? defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length 
        : 0;
      
      if (isMissedDefect) {
        // AI said GOOD but operator found defect → REJECT board
        const inspectionData = {
          boardId,
          workOrderId: workOrder.id,
          lineId,
          sectionId,
          customerId,
          side: currentSide,
          boardSequence: boardSequenceRef.current,
          aiResult: 'GOOD',
          aiConfidence: 1.0,
          operatorDecision: 'MISSED_DEFECT',
          operatorId: user?.id,
          plcSignalSent: 'NG', // Board is actually NG
          cycleTimeMs: getCycleTimeMs(),
          shift: getCurrentShift(),
          defects: [{
            defectType: formData.reason.toLowerCase().replace('_missed', ''),
            severity: 'critical',
            confidence: 0,
            operatorDisposition: 'MISSED_DEFECT',
            falseCallNotes: formData.notes,
          }],
          defectCount: 1,
          falseCallReasonCode: formData.reason,
          imageFullPath: currentImage,
        };
        
        const saveResult = await saveInspection(inspectionData);
        
        // Add to sync queue for training (missed defect)
        try {
          await fetch('/api/sync-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inspectionId: saveResult.data?.id,
              boardId,
              lineName: lineName || `Line ${lineId}`,
              defectType: formData.reason,
              defectCount: 1,
              localImagePath: currentImage,
              recordType: 'missed_defect',
            }),
          });
        } catch (syncError) {
          console.error('Failed to add to sync queue:', syncError);
        }
        
        // Update WO counters (ng_qty++, false_call_qty++)
        await updateCounters(workOrder.id, { ngQty: 1, falseCallQty: 1 });
        
        // Send NG signal (board is actually NG)
        await signalNG(lineId, boardId, user?.id, currentSide);
        
        console.log('Missed defect reported:', { boardId, side: currentSide, reason: formData.reason });
        
        setShowFalseCallModal(false);
        
        // NG always goes to NEXT_PCB
        await signalNextPCB(lineId, boardId, user?.id, currentSide, {
          woNumber: workOrder.woNumber,
          boardSequence: boardSequenceRef.current,
        });
        
        await updateCounters(workOrder.id, { completedQty: 1 });
        boardSequenceRef.current += 1;
        setCurrentSide('TOP');
        resetForNextBoard();
        refreshWO();
        
      } else {
        // AI said NG but board is actually GOOD → PASS board
        const inspectionData = {
          boardId,
          workOrderId: workOrder.id,
          lineId,
          sectionId,
          customerId,
          side: currentSide,
          boardSequence: boardSequenceRef.current,
          aiResult: 'NG',
          aiConfidence: avgConfidence,
          operatorDecision: 'FALSE_CALL',
          operatorId: user?.id,
          plcSignalSent: 'GOOD', // Board is actually good
          cycleTimeMs: getCycleTimeMs(),
          shift: getCurrentShift(),
          defects: buildDefectsArray(defects, 'FALSE_CALL', formData),
          defectCount: defects.length,
          falseCallReasonCode: formData.reason,
          imageFullPath: currentImage,
        };
        
        const saveResult = await saveInspection(inspectionData);
        
        // Add to sync queue for training (false positive)
        try {
          await fetch('/api/sync-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inspectionId: saveResult.data?.id,
              boardId,
              lineName: lineName || `Line ${lineId}`,
              defectType: defects[0]?.class_name || 'unknown',
              defectCount: defects.length,
              localImagePath: currentImage,
              recordType: 'false_call',
            }),
          });
        } catch (syncError) {
          console.error('Failed to add to sync queue:', syncError);
        }
        
        // Update WO counters (good_qty++, false_call_qty++)
        await updateCounters(workOrder.id, { goodQty: 1, falseCallQty: 1 });
        
        // Send GOOD signal (board is actually good)
        await signalGood(lineId, boardId, user?.id, currentSide);
        
        console.log('False call reported:', { boardId, side: currentSide, reason: formData.reason });
        
        setShowFalseCallModal(false);
        
        // Handle side logic (treat as GOOD)
        await handleSideComplete('GOOD');
      }
      
    } catch (error) {
      console.error('False call error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [workOrder, lineId, lineName, boardId, currentSide, sectionId, customerId, 
      user, defects, currentImage, buildDefectsArray, updateCounters, handleSideComplete,
      resetForNextBoard, refreshWO]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFalseCallModal) return;
      if (!workOrder) return;
      
      // Simulate shortcuts (dev mode)
      if (aiResult === 'WAITING' && !isProcessing) {
        if (e.key.toLowerCase() === 'g') {
          simulateGood();
          return;
        }
        if (e.key.toLowerCase() === 'n') {
          simulateNG();
          return;
        }
      }
      
      if (!isOperator || isProcessing) return;
      
      switch (e.key.toLowerCase()) {
        case 'a':
          if (aiResult === 'GOOD') {
            handleApproveGood();
          } else if (aiResult === 'NG') {
            handleApproveNG();
          }
          break;
        case 'f':
          if (aiResult === 'NG' || aiResult === 'GOOD') {
            handleFalseCall();
          }
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
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
  }, [isOperator, isProcessing, showFalseCallModal, aiResult, workOrder,
      handleApproveGood, handleApproveNG, handleFalseCall, simulateGood, simulateNG,
      handlePrevDefect, handleNextDefect]);

  // ============ NO ACTIVE WO STATE ============

  if (!woLoading && !hasActiveWO) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-void p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-phosphor-amber mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            No Active Work Order
          </h1>
          <p className="text-text-secondary mb-6">
            There is no active work order assigned to this line. 
            Please contact Engineering to assign a work order.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onExit}
              className="px-6 py-3 bg-phosphor-red text-void font-display font-bold tracking-wider hover:shadow-glow-red transition-all"
            >
              EXIT
            </button>
            <button
              onClick={refreshWO}
              className="px-6 py-3 border border-phosphor-amber text-phosphor-amber font-display font-bold tracking-wider hover:bg-phosphor-amber/10 transition-all"
            >
              REFRESH
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine if actions should be disabled
  const actionsDisabled = !isOperator || isProcessing || isPaused || !connected || aiResult === 'WAITING';

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* ============ HEADER ============ */}
      <header className="h-14 flex-shrink-0 bg-panel border-b border-surface-border flex items-center justify-between px-4">
        {/* Left: Menu + Logo + Line Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={showSidebar}
            className="p-2 border border-surface-border text-text-secondary hover:border-phosphor-amber/50 hover:text-phosphor-amber transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

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

        {/* Center: WO Info + Side + Status */}
        <div className="flex items-center gap-4">
          {/* Work Order */}
          {workOrder && (
            <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
              <Package className="w-4 h-4 text-text-tertiary" />
              <div>
                <p className="font-mono text-xxs text-text-tertiary">WORK ORDER</p>
                <p className="font-mono text-sm font-bold text-phosphor-cyan">{workOrder.woNumber}</p>
              </div>
            </div>
          )}

          {/* Current Side */}
          {workOrder?.sideCount === 2 && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 border",
              currentSide === 'TOP' 
                ? "border-phosphor-amber/50 bg-phosphor-amber/10"
                : "border-phosphor-cyan/50 bg-phosphor-cyan/10"
            )}>
              <Layers className={cn(
                "w-4 h-4",
                currentSide === 'TOP' ? "text-phosphor-amber" : "text-phosphor-cyan"
              )} />
              <span className={cn(
                "font-mono text-sm font-bold",
                currentSide === 'TOP' ? "text-phosphor-amber" : "text-phosphor-cyan"
              )}>
                {currentSide}
              </span>
            </div>
          )}

          {/* Board ID */}
          <div className="flex items-center gap-2 px-4 py-2 bg-terminal border border-surface-border">
            <div>
              <p className="font-mono text-xxs text-text-tertiary">BOARD</p>
              <p className="font-mono text-sm font-bold text-text-primary">{boardId}</p>
            </div>
          </div>

          {/* AI Result Status */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 border",
            aiResult === 'NG' && "bg-phosphor-red/10 border-phosphor-red/50",
            aiResult === 'GOOD' && "bg-phosphor-green/10 border-phosphor-green/50",
            aiResult === 'WAITING' && "bg-terminal border-surface-border"
          )}>
            {aiResult === 'NG' && <AlertTriangle className="w-5 h-5 text-phosphor-red" />}
            {aiResult === 'GOOD' && <CheckCircle2 className="w-5 h-5 text-phosphor-green" />}
            {aiResult === 'WAITING' && <Clock className="w-5 h-5 text-text-tertiary" />}
            <span className={cn(
              "font-display font-bold text-sm tracking-wider",
              aiResult === 'NG' && "text-phosphor-red",
              aiResult === 'GOOD' && "text-phosphor-green",
              aiResult === 'WAITING' && "text-text-tertiary"
            )}>
              {aiResult === 'NG' ? 'NG DETECTED' : aiResult === 'GOOD' ? 'GOOD' : 'WAITING'}
            </span>
          </div>

          {/* Timer */}
          {aiResult === 'NG' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-terminal border border-surface-border">
              <Clock className={cn("w-4 h-4", getTimerColor())} />
              <span className={cn("font-mono text-lg font-bold", getTimerColor())}>
                {formatWaitTime(waitTime)}
              </span>
            </div>
          )}

          {/* GOOD Countdown */}
          {aiResult === 'GOOD' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-phosphor-green/10 border border-phosphor-green/50">
              <span className="font-mono text-sm text-phosphor-green">Auto in</span>
              <span className="font-mono text-xl font-bold text-phosphor-green">
                {goodCountdown}s
              </span>
            </div>
          )}
        </div>

        {/* Right: User + Time */}
        <div className="flex items-center gap-4">
          {!isOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-phosphor-cyan/10 border border-phosphor-cyan/30">
              <span className="font-mono text-xs font-bold text-phosphor-cyan">VIEW ONLY</span>
            </div>
          )}

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

          <span className="font-mono text-sm text-phosphor-amber">{currentTime}</span>

          <div className="flex items-center gap-2 px-3 py-2 bg-terminal border border-surface-border">
            <User className="w-4 h-4 text-text-tertiary" />
            <span className="font-mono text-xs text-text-primary">{user?.name || 'Unknown'}</span>
          </div>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Defect View - 70% */}
        <div className="w-[70%] flex flex-col p-3 gap-2">
          <DefectViewPanel
            imageSrc={currentImage}
            detection={currentDefect}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            title={`DEFECT VIEW - ${currentSide}`}
            className="flex-1"
          />
          
          {/* Defect Navigation - Always show when NG */}
          {aiResult === 'NG' && (
            <div className="flex items-center justify-center gap-4 py-2 bg-panel border border-surface-border">
              <button
                onClick={handlePrevDefect}
                disabled={currentDefectIndex === 0 || defects.length <= 1}
                className={cn(
                  "px-4 py-2 border font-mono text-sm transition-colors",
                  (currentDefectIndex === 0 || defects.length <= 1)
                    ? "border-surface-border text-text-tertiary cursor-not-allowed opacity-50"
                    : "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber/10"
                )}
              >
                ◄ PREV (J)
              </button>
              
              <div className="flex items-center gap-2 px-4 py-1 bg-terminal border border-surface-border">
                <span className="font-mono text-sm text-text-tertiary">DEFECT</span>
                <span className="font-mono text-lg font-bold text-phosphor-amber">
                  {currentDefectIndex + 1}
                </span>
                <span className="font-mono text-sm text-text-tertiary">of</span>
                <span className="font-mono text-lg font-bold text-phosphor-amber">
                  {defects.length || 1}
                </span>
              </div>
              
              <button
                onClick={handleNextDefect}
                disabled={currentDefectIndex >= defects.length - 1 || defects.length <= 1}
                className={cn(
                  "px-4 py-2 border font-mono text-sm transition-colors",
                  (currentDefectIndex >= defects.length - 1 || defects.length <= 1)
                    ? "border-surface-border text-text-tertiary cursor-not-allowed opacity-50"
                    : "border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber/10"
                )}
              >
                NEXT (K) ►
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - 30% */}
        <div className="w-[30%] flex flex-col p-3 pl-0 gap-2 overflow-hidden">
          {/* Detection Info - Compact */}
          <DetectionResultPanel
            detection={currentDefect}
            aiResult={aiResult}
            defectIndex={currentDefectIndex}
            defectCount={defects.length}
          />

          {/* Board Overview - Shows full board with defect markers */}
          <BoardOverview
            imageSrc={currentImage}
            defects={defects}
            currentDefectIndex={currentDefectIndex}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            onDefectSelect={handleDefectSelect}
            className="flex-1 min-h-[200px]"
          />
        </div>
      </main>

      {/* ============ FOOTER: ACTIONS ============ */}
      <footer className="h-24 flex-shrink-0 bg-panel border-t border-surface-border flex items-center justify-between px-4">
        {/* Left: WO Stats */}
        <div className="flex items-center gap-4">
          {workOrder && (
            <div className="flex items-center gap-6 px-4 py-2 bg-terminal border border-surface-border">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-tertiary">PROGRESS</span>
                <span className="font-mono text-xl font-bold text-phosphor-amber">
                  {workOrder.completedQty}/{workOrder.lotSize}
                </span>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-phosphor-green" />
                <span className="font-mono text-xl font-bold text-phosphor-green">{workOrder.goodQty}</span>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-phosphor-red" />
                <span className="font-mono text-xl font-bold text-phosphor-red">{workOrder.ngQty}</span>
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
          )}
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center gap-4">
          {/* Simulate buttons (dev mode only) */}
          {DEV_MODE && aiResult === 'WAITING' && (
            <>
              <button
                onClick={simulateGood}
                disabled={isProcessing || !workOrder}
                className={cn(
                  "h-14 px-5 flex items-center gap-2 border-2 transition-all",
                  "font-display text-sm font-bold tracking-wider",
                  "bg-phosphor-green/10 border-phosphor-green text-phosphor-green",
                  "hover:bg-phosphor-green hover:text-void",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <FlaskConical className="w-5 h-5" />
                <span>SIM GOOD (G)</span>
              </button>
              <button
                onClick={simulateNG}
                disabled={isProcessing || !workOrder}
                className={cn(
                  "h-14 px-5 flex items-center gap-2 border-2 transition-all",
                  "font-display text-sm font-bold tracking-wider",
                  "bg-phosphor-red/10 border-phosphor-red text-phosphor-red",
                  "hover:bg-phosphor-red hover:text-void",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <FlaskConical className="w-5 h-5" />
                <span>SIM NG (N)</span>
              </button>
            </>
          )}

          {/* APPROVE */}
          <button
            onClick={aiResult === 'GOOD' ? handleApproveGood : handleApproveNG}
            disabled={actionsDisabled}
            className={cn(
              "h-16 px-10 flex items-center gap-3 border-2 transition-all",
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

          {/* FALSE CALL - works for both NG and GOOD */}
          <button
            onClick={handleFalseCall}
            disabled={actionsDisabled}
            className={cn(
              "h-16 px-10 flex items-center gap-3 border-2 transition-all",
              "font-display text-lg font-bold tracking-wider",
              actionsDisabled
                ? "bg-surface-border/20 border-surface-border text-text-tertiary cursor-not-allowed"
                : aiResult === 'GOOD'
                  ? "bg-phosphor-red/10 border-phosphor-red text-phosphor-red hover:bg-phosphor-red hover:text-void hover:shadow-glow-red"
                  : "bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber hover:bg-phosphor-amber hover:text-void hover:shadow-glow-amber"
            )}
          >
            <Flag className="w-6 h-6" />
            <span>{aiResult === 'GOOD' ? 'MISSED DEFECT' : 'FALSE CALL'}</span>
            <span className="font-mono text-xs opacity-60">(F)</span>
          </button>
        </div>

        {/* Right: Pause + Stop */}
        <div className="flex items-center gap-3">
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
        aiResult={aiResult}
        isProcessing={isProcessing}
      />

      {/* Flip Notice */}
      {showFlipNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-panel border-2 border-phosphor-cyan p-8 text-center">
            <RotateCcw className="w-16 h-16 text-phosphor-cyan mx-auto mb-4 animate-spin" />
            <h2 className="font-display text-2xl font-bold text-phosphor-cyan mb-2">
              FLIP TO BOTTOM
            </h2>
            <p className="text-text-secondary">
              Please flip the PCB to inspect the bottom side
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveViewV3;

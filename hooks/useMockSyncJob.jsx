import { useState, useEffect, useRef, useCallback } from 'react';

export function useMockSyncJob({ totalItems }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  const intervalRef = useRef(null);
  const pausedProgressRef = useRef(0);
  const startTimeRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const updateStepInfo = useCallback((currentProgress) => {
    if (currentProgress < 25) {
      setCurrentStep('Preparing payload...');
      const remaining = Math.ceil((25 - currentProgress) * 0.5);
      setEstimatedTime(`~${remaining} seconds remaining`);
    } else if (currentProgress < 75) {
      const batchNumber = Math.floor((currentProgress - 25) / 12.5) + 1;
      const totalBatches = Math.ceil(totalItems / 5) || 4;
      setCurrentStep(`Uploading batch ${batchNumber}/${totalBatches}`);
      const remaining = Math.ceil((75 - currentProgress) * 0.8);
      setEstimatedTime(`~${remaining} seconds remaining`);
    } else if (currentProgress < 100) {
      setCurrentStep('Waiting for confirmation...');
      const remaining = Math.ceil((100 - currentProgress) * 0.3);
      setEstimatedTime(`~${remaining} seconds remaining`);
    } else {
      setCurrentStep('Completed');
      setEstimatedTime('Done');
    }
  }, [totalItems]);

  const startSync = useCallback(() => {
    clearTimer();
    setIsSyncing(true);
    setStatus('running');
    setProgress(0);
    pausedProgressRef.current = 0;
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setStatus('completed');
          setIsSyncing(false);
          setProgress(100);
          setCurrentStep('Completed');
          setEstimatedTime('Done');
          return 100;
        }
        updateStepInfo(next);
        return next;
      });
    }, 200);
  }, [clearTimer, updateStepInfo]);

  const pauseSync = useCallback(() => {
    clearTimer();
    setStatus('paused');
    pausedProgressRef.current = progress;
  }, [clearTimer, progress]);

  const resumeSync = useCallback(() => {
    setStatus('running');

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setStatus('completed');
          setIsSyncing(false);
          setProgress(100);
          setCurrentStep('Completed');
          setEstimatedTime('Done');
          return 100;
        }
        updateStepInfo(next);
        return next;
      });
    }, 200);
  }, [updateStepInfo]);

  const cancelSync = useCallback(() => {
    clearTimer();
    setIsSyncing(false);
    setStatus('idle');
    setProgress(0);
    pausedProgressRef.current = 0;
    setCurrentStep('');
    setEstimatedTime('');
  }, [clearTimer]);

  const resetSync = useCallback(() => {
    clearTimer();
    setIsSyncing(false);
    setStatus('idle');
    setProgress(0);
    pausedProgressRef.current = 0;
    setCurrentStep('');
    setEstimatedTime('');
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isSyncing,
    progress,
    status,
    currentStep,
    estimatedTime,
    startSync,
    pauseSync,
    resumeSync,
    cancelSync,
    resetSync,
  };
}

'use client';

/**
 * Next PCB Confirmation Modal
 * Shown after operator rejects a board
 * Operator must confirm they removed the PCB before continuing
 */

import { useEffect, useCallback } from 'react';
import { AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NextPCBConfirmModal({
  isOpen,
  boardId,
  onConfirm,
  isProcessing = false,
}) {
  // Handle Enter key to confirm
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isOpen && !isProcessing) {
      onConfirm();
    }
  }, [isOpen, isProcessing, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90" />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div className="bg-panel border-2 border-phosphor-red shadow-glow-red">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 bg-phosphor-red/10 border-b border-phosphor-red/30">
            <div className="w-12 h-12 flex items-center justify-center bg-phosphor-red/20 border border-phosphor-red">
              <AlertTriangle className="w-6 h-6 text-phosphor-red" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-phosphor-red tracking-wide">
                BOARD REJECTED
              </h2>
              <p className="font-mono text-xs text-text-tertiary">
                NG Signal sent to PLC
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            {/* Board ID */}
            <div className="flex items-center gap-3 p-3 bg-terminal border border-surface-border">
              <Package className="w-5 h-5 text-text-tertiary" />
              <div>
                <span className="font-mono text-xs text-text-tertiary">Board ID:</span>
                <p className="font-mono text-lg font-bold text-text-primary">{boardId}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-phosphor-amber/10 border border-phosphor-amber/30">
              <p className="font-display text-sm text-phosphor-amber mb-2">
                ⚠️ ACTION REQUIRED
              </p>
              <p className="font-mono text-sm text-text-secondary leading-relaxed">
                Please <span className="text-phosphor-amber font-bold">REMOVE THE PCB</span> from 
                the conveyor before continuing to the next board.
              </p>
            </div>

            {/* Warning */}
            <p className="font-mono text-xs text-text-tertiary text-center">
              Pressing continue will send NEXT signal to PLC
            </p>
          </div>

          {/* Action */}
          <div className="px-6 py-4 bg-terminal border-t border-surface-border">
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className={cn(
                "w-full h-14 flex items-center justify-center gap-3",
                "font-display text-lg font-bold tracking-wider",
                "bg-phosphor-green text-void",
                "hover:shadow-glow-green transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-void border-t-transparent animate-spin" />
                  <span>SENDING SIGNAL...</span>
                </>
              ) : (
                <>
                  <span>CONTINUE TO NEXT PCB</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <p className="font-mono text-xs text-text-tertiary text-center mt-3">
              Press <span className="px-1.5 py-0.5 bg-void border border-surface-border text-phosphor-amber">ENTER</span> to confirm
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NextPCBConfirmModal;

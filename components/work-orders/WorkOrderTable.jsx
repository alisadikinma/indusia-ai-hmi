/**
 * Work Order Table
 * Displays work orders in a table with actions
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle,
  Trash2,
  Edit,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Clock,
  Target,
  Info,
  MessageSquare,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import CustomerLogo from '@/components/common/CustomerLogo';

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format datetime for display
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Progress bar component
 */
function ProgressBar({ current, total, className }) {
  const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-indusia-bg rounded-full overflow-hidden">
        <div 
          className="h-full bg-indusia-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-indusia-textMuted whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  );
}

/**
 * Completion info popover — shows reason & who completed on click
 */
function CompletionInfoPopover({ workOrder }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="ml-1.5 p-0.5 rounded-full text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-indusia-surface border border-indusia-border rounded-lg shadow-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-indusia-textMuted uppercase tracking-wider mb-0.5">Reason</p>
              <p className="text-xs text-indusia-text leading-relaxed">
                {workOrder.completionReason}
              </p>
            </div>
          </div>
          {workOrder.completedBy && (
            <div className="flex items-start gap-2 pt-1.5 border-t border-indusia-border">
              <UserCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-indusia-textMuted uppercase tracking-wider mb-0.5">Completed by</p>
                <p className="text-xs text-indusia-text">
                  {workOrder.completedByName || workOrder.completedBy}
                </p>
              </div>
            </div>
          )}
          {workOrder.completedAt && (
            <div className="flex items-start gap-2 pt-1.5 border-t border-indusia-border">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-indusia-textMuted uppercase tracking-wider mb-0.5">Completed at</p>
                <p className="text-xs text-indusia-text">
                  {formatDateTime(workOrder.completedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Action dropdown menu
 */
function ActionMenu({ workOrder, onStart, onComplete, onEdit, onDelete, onHold, onResume }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const hasProduction = (workOrder.completedQty || 0) >= 1;
  const canStart = workOrder.status === 'draft' || workOrder.status === 'ready';
  const canComplete = workOrder.status === 'active' || workOrder.status === 'on_hold';
  const canHold = workOrder.status === 'active' && hasProduction;
  const canResume = workOrder.status === 'on_hold';
  // Can only edit info if WO has NOT started production
  const canEdit = ['draft', 'ready', 'active'].includes(workOrder.status) && !hasProduction;
  const canDelete = workOrder.status === 'draft';

  const handleToggle = (e) => {
    if (!open) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 160,
      });
    }
    setOpen(!open);
  };

  const hasAnyAction = canStart || canComplete || canHold || canResume || canEdit || canDelete;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={cn(
          "p-2 rounded-lg transition-colors",
          "hover:bg-indusia-surface text-indusia-textMuted hover:text-indusia-text"
        )}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "fixed z-50",
              "w-[160px] bg-indusia-surface border border-indusia-border rounded-lg shadow-xl",
              "py-1"
            )}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {canStart && (
              <button
                onClick={() => { onStart(workOrder); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm",
                  "flex items-center gap-2",
                  "hover:bg-indusia-bg text-green-400"
                )}
              >
                <Play className="w-4 h-4" />
                Start WO
              </button>
            )}

            {canResume && (
              <button
                onClick={() => { onResume(workOrder); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm",
                  "flex items-center gap-2",
                  "hover:bg-indusia-bg text-green-400"
                )}
              >
                <Play className="w-4 h-4" />
                Resume WO
              </button>
            )}

            {canHold && (
              <button
                onClick={() => { onHold(workOrder); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm",
                  "flex items-center gap-2",
                  "hover:bg-indusia-bg text-yellow-400"
                )}
              >
                <Pause className="w-4 h-4" />
                Hold WO
              </button>
            )}

            {canComplete && (
              <button
                onClick={() => { onComplete(workOrder); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm",
                  "flex items-center gap-2",
                  "hover:bg-indusia-bg text-purple-400"
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Complete WO
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => { onEdit(workOrder); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm",
                  "flex items-center gap-2",
                  "hover:bg-indusia-bg text-indusia-text"
                )}
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}

            {canDelete && (
              <>
                <div className="border-t border-indusia-border my-1" />
                <button
                  onClick={() => { onDelete(workOrder); setOpen(false); }}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm",
                    "flex items-center gap-2",
                    "hover:bg-indusia-bg text-red-400"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}

            {!hasAnyAction && (
              <div className="px-4 py-2 text-sm text-indusia-textMuted">
                No actions available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function WorkOrderTable({
  workOrders = [],
  loading = false,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  onHold,
  onResume,
  sortBy = 'created_at',
  sortDirection = 'desc',
  onSort,
}) {
  const handleSort = (column) => {
    if (onSort) {
      const newDirection = sortBy === column && sortDirection === 'desc' ? 'asc' : 'desc';
      onSort(column, newDirection);
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return null;
    return sortDirection === 'desc' 
      ? <ChevronDown className="w-4 h-4" />
      : <ChevronUp className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="bg-indusia-surface border border-indusia-border rounded-lg overflow-hidden">
        <div className="animate-pulse p-8 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-indusia-bg rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="bg-indusia-surface border border-indusia-border rounded-lg p-12 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-indusia-textMuted mb-4" />
        <p className="text-indusia-textMuted">No work orders found</p>
      </div>
    );
  }

  return (
    <div className="bg-indusia-surface border border-indusia-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-indusia-bg/50 border-b border-indusia-border">
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider cursor-pointer hover:text-indusia-text"
                onClick={() => handleSort('wo_number')}
              >
                <div className="flex items-center gap-1">
                  WO Number
                  <SortIcon column="wo_number" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider">
                Customer / Board
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider">
                Line
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider cursor-pointer hover:text-indusia-text"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon column="status" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider">
                Yield
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase tracking-wider cursor-pointer hover:text-indusia-text"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-1">
                  Created
                  <SortIcon column="created_at" />
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-indusia-textMuted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indusia-border">
            {workOrders.map((wo) => (
              <tr 
                key={wo.id} 
                className="hover:bg-indusia-bg/30 transition-colors"
              >
                {/* WO Number */}
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className="font-mono font-medium text-indusia-primary">
                      {wo.woNumber}
                    </span>
                    <span className="text-xs text-indusia-textMuted flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {wo.sideCount === 2 ? 'TOP + BOTTOM' : 'TOP Only'}
                    </span>
                  </div>
                </td>

                {/* Customer / Board */}
                <td className="px-4 py-4">
                  <div className="flex items-start gap-2">
                    <CustomerLogo customer={wo.customer} size="sm" className="mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-indusia-text">
                        {wo.customer?.name || '-'}
                      </span>
                      <span className="text-xs text-indusia-textMuted">
                        {wo.board?.name || '-'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Line */}
                <td className="px-4 py-4">
                  <span className="text-indusia-text">
                    {wo.line?.name || '-'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <WorkOrderStatusBadge status={wo.status} size="small" />
                    {wo.status === 'completed' && wo.completionReason && (
                      <CompletionInfoPopover workOrder={wo} />
                    )}
                  </div>
                </td>

                {/* Progress */}
                <td className="px-4 py-4 min-w-[140px]">
                  <ProgressBar 
                    current={wo.completedQty} 
                    total={wo.lotSize} 
                  />
                </td>

                {/* Yield */}
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className={cn(
                      "font-mono font-medium",
                      parseFloat(wo.yieldPercent) >= 95 ? "text-green-400" :
                      parseFloat(wo.yieldPercent) >= 85 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {wo.yieldPercent}%
                    </span>
                    <span className="text-xs text-indusia-textMuted">
                      {wo.goodQty}G / {wo.ngQty}NG / {wo.falseCallQty}FC
                    </span>
                  </div>
                </td>

                {/* Created */}
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className="text-indusia-text text-sm">
                      {formatDateTime(wo.createdAt)}
                    </span>
                    {wo.dueDate && (
                      <span className="text-xs text-indusia-textMuted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {formatDate(wo.dueDate)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 text-right">
                  <ActionMenu
                    workOrder={wo}
                    onStart={onStart}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onHold={onHold}
                    onResume={onResume}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WorkOrderTable;

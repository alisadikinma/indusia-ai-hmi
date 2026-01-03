/**
 * Work Order Table
 * Displays work orders in a table with actions
 */

'use client';

import { useState } from 'react';
import { 
  Play, 
  CheckCircle, 
  Trash2, 
  Edit, 
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Clock,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';

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
 * Action dropdown menu
 */
function ActionMenu({ workOrder, onStart, onComplete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);

  const canStart = workOrder.status === 'draft' || workOrder.status === 'ready';
  const canComplete = workOrder.status === 'active';
  const canEdit = workOrder.status === 'draft';
  const canDelete = workOrder.status === 'draft';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
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
          <div className={cn(
            "absolute right-0 top-full mt-1 z-50",
            "min-w-[160px] bg-indusia-surface border border-indusia-border rounded-lg shadow-xl",
            "py-1"
          )}>
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

            {!canStart && !canComplete && !canEdit && !canDelete && (
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
                  <div className="flex flex-col">
                    <span className="text-indusia-text">
                      {wo.customer?.name || '-'}
                    </span>
                    <span className="text-xs text-indusia-textMuted">
                      {wo.board?.name || '-'}
                    </span>
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
                  <WorkOrderStatusBadge status={wo.status} size="small" />
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

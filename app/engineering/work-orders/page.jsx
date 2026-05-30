/**
 * Work Orders Management Page
 * Engineering module for creating and managing production work orders
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import PageLoading from '@/components/common/PageLoading';
import { useWorkOrders, useWorkOrderMutations } from '@/hooks/useWorkOrders';
import { WorkOrderTable } from '@/components/work-orders/WorkOrderTable';
import { WorkOrderFilters } from '@/components/work-orders/WorkOrderFilters';
import { WorkOrderForm } from '@/components/work-orders/WorkOrderForm';
import { WorkOrderStats } from '@/components/work-orders/WorkOrderStats';

// Modal component
function Modal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-indusia-surface border border-indusia-border rounded-xl shadow-2xl w-full max-w-2xl m-4">
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Confirm dialog
function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', loading = false, confirmDisabled = false, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-indusia-surface border border-indusia-border rounded-xl shadow-2xl w-full max-w-md m-4 p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-indusia-text mb-2">{title}</h3>
            <p className="text-indusia-textMuted">{message}</p>
          </div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 border border-indusia-border rounded-lg",
              "text-indusia-textMuted hover:text-indusia-text transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={cn(
              "px-4 py-2 bg-indusia-primary text-white rounded-lg",
              "hover:bg-indusia-primary/90 transition-colors",
              (loading || confirmDisabled) && "opacity-60 cursor-not-allowed"
            )}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast notification
function Toast({ show, type = 'success', message, onClose }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg",
        type === 'success' ? "bg-green-500/20 border border-green-500/30" : "bg-red-500/20 border border-red-500/30"
      )}>
        {type === 'success' ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-400" />
        )}
        <span className={cn(
          type === 'success' ? "text-green-400" : "text-red-400"
        )}>
          {message}
        </span>
        <button onClick={onClose} className="ml-2 text-indusia-textMuted hover:text-indusia-text">
          ×
        </button>
      </div>
    </div>
  );
}

export default function WorkOrdersPage() {
  const { user, hasMenuAccess, isLoading: authLoading } = useAuth();
  
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const {
    workOrders,
    loading,
    error,
    count,
    filters,
    setFilters,
    refresh
  } = useWorkOrders({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, orderBy: 'created_at', orderDirection: 'desc' });

  // Re-fetch when page changes
  const setPageAndFetch = useCallback((pageOrFn) => {
    setPage(prev => {
      const newPage = typeof pageOrFn === 'function' ? pageOrFn(prev) : pageOrFn;
      setFilters({ offset: newPage * PAGE_SIZE });
      return newPage;
    });
  }, [setFilters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  const { 
    loading: mutationLoading, 
    create, 
    update, 
    remove, 
    start, 
    complete 
  } = useWorkOrderMutations();

  // UI State - must be before conditional returns
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWO, setEditingWO] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, workOrder: null });
  const [completionReason, setCompletionReason] = useState('');
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  // Show toast notification
  const showToast = useCallback((type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 4000);
  }, []);

  // Show loading while auth or work orders data is loading
  if (authLoading || loading) {
    return <PageLoading />;
  }

  // Check access via database permissions
  if (!user || !hasMenuAccess('menu_work_orders')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-indusia-text mb-2">Access Denied</h2>
          <p className="text-indusia-textMuted">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Handle create work order
  const handleCreate = async (data) => {
    const result = await create(data);
    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} created`);
      setShowCreateModal(false);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to create work order');
    }
  };

  // Handle update work order
  const handleUpdate = async (data) => {
    if (!editingWO) return;
    const result = await update(editingWO.id, data);
    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} updated`);
      setEditingWO(null);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to update work order');
    }
  };

  // Handle start work order
  const handleStart = (workOrder) => {
    setConfirmDialog({
      open: true,
      type: 'start',
      workOrder,
    });
  };

  const confirmStart = async () => {
    const { workOrder } = confirmDialog;
    const result = await start(workOrder.id);
    setConfirmDialog({ open: false, type: null, workOrder: null });
    
    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} started`);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to start work order');
    }
  };

  // Handle hold work order
  const handleHold = (workOrder) => {
    setConfirmDialog({
      open: true,
      type: 'hold',
      workOrder,
    });
  };

  const confirmHold = async () => {
    const { workOrder } = confirmDialog;
    const result = await update(workOrder.id, { status: 'on_hold' });
    setConfirmDialog({ open: false, type: null, workOrder: null });

    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} put on hold`);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to hold work order');
    }
  };

  // Handle resume work order
  const handleResume = (workOrder) => {
    setConfirmDialog({
      open: true,
      type: 'resume',
      workOrder,
    });
  };

  const confirmResume = async () => {
    const { workOrder } = confirmDialog;
    const result = await update(workOrder.id, { status: 'active' });
    setConfirmDialog({ open: false, type: null, workOrder: null });

    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} resumed`);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to resume work order');
    }
  };

  // Handle complete work order
  const handleComplete = (workOrder) => {
    setCompletionReason('');
    setConfirmDialog({
      open: true,
      type: 'complete',
      workOrder,
    });
  };

  const confirmComplete = async () => {
    const { workOrder } = confirmDialog;
    const isIncomplete = workOrder.completedQty < workOrder.lotSize;

    if (isIncomplete && !completionReason.trim()) {
      showToast('error', 'Please provide a reason for force-completing this work order');
      return;
    }

    const result = await complete(workOrder.id, {
      reason: completionReason.trim() || null,
      completedBy: user?.id || user?.userId,
    });
    setConfirmDialog({ open: false, type: null, workOrder: null });
    setCompletionReason('');

    if (result.success) {
      showToast('success', `Work Order ${result.data.woNumber} completed`);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to complete work order');
    }
  };

  // Handle delete work order
  const handleDelete = (workOrder) => {
    setConfirmDialog({
      open: true,
      type: 'delete',
      workOrder,
    });
  };

  const confirmDelete = async () => {
    const { workOrder } = confirmDialog;
    const result = await remove(workOrder.id);
    setConfirmDialog({ open: false, type: null, workOrder: null });
    
    if (result.success) {
      showToast('success', `Work Order ${workOrder.woNumber} deleted`);
      refresh();
    } else {
      showToast('error', result.error || 'Failed to delete work order');
    }
  };

  // Handle edit
  const handleEdit = (workOrder) => {
    setEditingWO(workOrder);
  };

  // Handle filter change
  const handleFilterChange = (newFilters) => {
    setPage(0); // Reset to first page when filters change
    setFilters({ ...newFilters, offset: 0 });
  };

  // Handle sort
  const handleSort = (column, direction) => {
    setSortBy(column);
    setSortDirection(direction);
    setFilters({ orderBy: column, orderDirection: direction });
  };

  // Confirm dialog content
  const getConfirmContent = () => {
    const { type, workOrder } = confirmDialog;
    switch (type) {
      case 'start':
        return {
          title: 'Start Work Order?',
          message: `This will set ${workOrder?.woNumber} as the active work order for ${workOrder?.line?.name}. Any existing active WO on this line will be blocked.`,
          confirmText: 'Start WO',
        };
      case 'hold':
        return {
          title: 'Hold Work Order?',
          message: `This will put ${workOrder?.woNumber} on hold. The line will stop receiving new inspections. Progress: ${workOrder?.completedQty}/${workOrder?.lotSize}`,
          confirmText: 'Hold WO',
        };
      case 'resume':
        return {
          title: 'Resume Work Order?',
          message: `This will resume ${workOrder?.woNumber} and set it back to active on ${workOrder?.line?.name}. Progress: ${workOrder?.completedQty}/${workOrder?.lotSize}`,
          confirmText: 'Resume WO',
        };
      case 'complete': {
        const isIncomplete = workOrder?.completedQty < workOrder?.lotSize;
        return {
          title: isIncomplete ? 'Force Complete Work Order?' : 'Complete Work Order?',
          message: isIncomplete
            ? `${workOrder?.woNumber} is only ${workOrder?.completedQty}/${workOrder?.lotSize} (${workOrder?.progress}%). A reason is required to force-complete.`
            : `This will mark ${workOrder?.woNumber} as completed. Progress: ${workOrder?.completedQty}/${workOrder?.lotSize} (Yield: ${workOrder?.yieldPercent}%)`,
          confirmText: isIncomplete ? 'Force Complete' : 'Complete WO',
        };
      }
      case 'delete':
        return {
          title: 'Delete Work Order?',
          message: `This will permanently delete ${workOrder?.woNumber}. This action cannot be undone.`,
          confirmText: 'Delete',
        };
      default:
        return { title: '', message: '', confirmText: '' };
    }
  };

  const confirmContent = getConfirmContent();

  return (
    <div className="min-h-screen bg-indusia-bg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indusia-primary/20 rounded-lg">
            <FileText className="w-6 h-6 text-indusia-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-indusia-text">
              Work Orders
            </h1>
            <p className="text-sm text-indusia-textMuted">
              {count} work order{count !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            "px-4 py-2 bg-indusia-primary text-white rounded-lg",
            "hover:bg-indusia-primary/90 transition-colors",
            "flex items-center gap-2 font-medium"
          )}
        >
          <Plus className="w-5 h-5" />
          New Work Order
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <WorkOrderStats workOrders={workOrders} />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <WorkOrderFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onRefresh={refresh}
          loading={loading}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <WorkOrderTable
        workOrders={workOrders}
        loading={loading}
        onStart={handleStart}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onHold={handleHold}
        onResume={handleResume}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-text-secondary font-mono">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} of {count}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageAndFetch(0)}
              disabled={page === 0}
              className="px-2 py-1 text-xs font-mono rounded border border-surface-border text-text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setPageAndFetch(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs font-mono rounded border border-surface-border text-text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-xs font-mono text-phosphor-teal">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPageAndFetch(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs font-mono rounded border border-surface-border text-text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setPageAndFetch(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs font-mono rounded border border-surface-border text-text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <WorkOrderForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          isLoading={mutationLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingWO} onClose={() => setEditingWO(null)}>
        <WorkOrderForm
          workOrder={editingWO}
          onSubmit={handleUpdate}
          onCancel={() => setEditingWO(null)}
          isLoading={mutationLoading}
        />
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => { setConfirmDialog({ open: false, type: null, workOrder: null }); setCompletionReason(''); }}
        onConfirm={
          confirmDialog.type === 'start' ? confirmStart :
          confirmDialog.type === 'hold' ? confirmHold :
          confirmDialog.type === 'resume' ? confirmResume :
          confirmDialog.type === 'complete' ? confirmComplete :
          confirmDialog.type === 'delete' ? confirmDelete :
          () => {}
        }
        title={confirmContent.title}
        message={confirmContent.message}
        confirmText={confirmContent.confirmText}
        loading={mutationLoading}
        confirmDisabled={
          confirmDialog.type === 'complete' &&
          confirmDialog.workOrder?.completedQty < confirmDialog.workOrder?.lotSize &&
          !completionReason.trim()
        }
      >
        {confirmDialog.type === 'complete' && confirmDialog.workOrder?.completedQty < confirmDialog.workOrder?.lotSize && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-yellow-400 mb-2">
              Reason for force completion (required)
            </label>
            <textarea
              value={completionReason}
              onChange={(e) => setCompletionReason(e.target.value)}
              placeholder="Enter reason for completing this incomplete work order..."
              rows={3}
              className={cn(
                "w-full px-3 py-2 bg-indusia-bg border rounded-lg text-indusia-text text-sm",
                "focus:outline-none focus:ring-2 focus:ring-indusia-primary",
                !completionReason.trim() ? "border-yellow-500/50" : "border-indusia-border"
              )}
            />
          </div>
        )}
      </ConfirmDialog>

      {/* Toast */}
      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ show: false, type: 'success', message: '' })}
      />
    </div>
  );
}

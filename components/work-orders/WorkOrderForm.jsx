/**
 * Work Order Form
 * Create/Edit work order form with cascading selectors
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMasterData } from '@/hooks/useMasterData';
import { authFetch } from '@/lib/utils/authFetch';

export function WorkOrderForm({
  workOrder = null,
  onSubmit,
  onCancel,
  isLoading = false
}) {
  const { customers, sections, lines, boards, loading: masterLoading } = useMasterData();

  const isEdit = !!workOrder;

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    boardId: '',
    lineId: '',
    sectionId: '',
    lotSize: 100,
    sideCount: 2,
    dueDate: '',
    priority: 0,
    notes: '',
  });

  const [errors, setErrors] = useState({});

  // WO Number state (separate from formData due to async validation lifecycle)
  const [woNumber, setWoNumber] = useState('');
  const [woNumberStatus, setWoNumberStatus] = useState('idle'); // idle | checking | available | taken | error
  const [woNumberLoading, setWoNumberLoading] = useState(true);

  // Filtered options based on selection
  const [filteredBoards, setFilteredBoards] = useState([]);
  const [filteredLines, setFilteredLines] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);

  // Fetch auto-generated WO number on mount (create mode only)
  useEffect(() => {
    if (!isEdit) {
      setWoNumberLoading(true);
      authFetch('/api/work-orders/next-number')
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data?.woNumber) {
            setWoNumber(result.data.woNumber);
            setWoNumberStatus('available');
          }
        })
        .catch(err => {
          console.error('[WorkOrderForm] Failed to fetch next WO number:', err);
        })
        .finally(() => setWoNumberLoading(false));
    }
  }, [isEdit]);

  // Initialize form with existing data
  useEffect(() => {
    if (workOrder) {
      setFormData({
        customerId: workOrder.customerId || '',
        boardId: workOrder.boardId || '',
        lineId: workOrder.lineId || '',
        sectionId: workOrder.sectionId || '',
        lotSize: workOrder.lotSize || 100,
        sideCount: workOrder.sideCount || 1,
        dueDate: workOrder.dueDate ? workOrder.dueDate.slice(0, 10) : '',
        priority: workOrder.priority || 0,
        notes: workOrder.notes || '',
      });
    }
  }, [workOrder]);

  // Update filtered options when customer changes
  useEffect(() => {
    if (formData.customerId) {
      setFilteredBoards(boards.filter(b => b.customerId === formData.customerId));
      setFilteredLines(lines.filter(l => l.customerId === formData.customerId));

      // Show all sections (not filtered by customer lines) so newly created sections appear
      setFilteredSections(sections);
    } else {
      setFilteredBoards([]);
      setFilteredLines([]);
      setFilteredSections(sections);
    }
  }, [formData.customerId, boards, lines, sections]);

  // Update filtered lines when section changes
  useEffect(() => {
    if (formData.customerId && formData.sectionId) {
      setFilteredLines(lines.filter(
        l => l.customerId === formData.customerId && l.sectionId === formData.sectionId
      ));
    } else if (formData.customerId) {
      setFilteredLines(lines.filter(l => l.customerId === formData.customerId));
    }
  }, [formData.sectionId, formData.customerId, lines]);

  // Check WO number availability
  const checkWoNumberAvailability = useCallback(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setWoNumberStatus('idle');
      return;
    }

    setWoNumberStatus('checking');
    try {
      const res = await authFetch(`/api/work-orders/check-number?woNumber=${encodeURIComponent(trimmed)}`);
      const result = await res.json();
      if (result.success) {
        setWoNumberStatus(result.data.available ? 'available' : 'taken');
        if (!result.data.available) {
          setErrors(prev => ({ ...prev, woNumber: 'This WO number is already in use' }));
        } else {
          setErrors(prev => ({ ...prev, woNumber: null }));
        }
      } else {
        setWoNumberStatus('error');
      }
    } catch {
      setWoNumberStatus('error');
    }
  }, []);

  const handleWoNumberBlur = () => {
    checkWoNumberAvailability(woNumber);
  };

  const handleWoNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkWoNumberAvailability(woNumber);
    }
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type } = e.target;

    let parsedValue = value;
    if (type === 'number') {
      parsedValue = value === '' ? '' : parseInt(value, 10);
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: parsedValue };

      // Reset dependent fields when parent changes
      if (name === 'customerId') {
        newData.boardId = '';
        newData.lineId = '';
        newData.sectionId = '';
      }
      if (name === 'sectionId') {
        newData.lineId = '';
      }

      return newData;
    });

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!isEdit) {
      if (!woNumber.trim()) {
        newErrors.woNumber = 'WO Number is required';
      } else if (woNumber.trim().length > 30) {
        newErrors.woNumber = 'WO Number must be 30 characters or less';
      } else if (/[^a-zA-Z0-9\-_]/.test(woNumber.trim())) {
        newErrors.woNumber = 'Only letters, numbers, dash (-) and underscore (_) allowed';
      } else if (woNumberStatus === 'taken') {
        newErrors.woNumber = 'This WO number is already in use';
      }
    }

    if (!formData.customerId) {
      newErrors.customerId = 'Customer is required';
    }
    if (!formData.boardId) {
      newErrors.boardId = 'Board is required';
    }
    if (!formData.lineId) {
      newErrors.lineId = 'Line is required';
    }
    if (!formData.lotSize || formData.lotSize < 1) {
      newErrors.lotSize = 'Lot size must be at least 1';
    }
    if (formData.sideCount < 1 || formData.sideCount > 2) {
      newErrors.sideCount = 'Side count must be 1 or 2';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run a fresh availability check if WO number hasn't been validated yet
    if (!isEdit && woNumber.trim() && woNumberStatus !== 'available') {
      await checkWoNumberAvailability(woNumber);
    }

    if (!validate()) return;

    onSubmit({
      ...formData,
      ...(isEdit ? {} : { woNumber: woNumber.trim() }),
    });
  };

  if (masterLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indusia-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-indusia-border">
        <h2 className="text-lg font-display font-bold text-indusia-text">
          {isEdit ? 'Edit Work Order' : 'Create Work Order'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-indusia-textMuted hover:text-indusia-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* WO Number (create mode only) */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            WO / PO Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={woNumber}
              onChange={(e) => {
                // Only allow alphanumeric, dash, underscore
                const filtered = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '');
                setWoNumber(filtered);
                setWoNumberStatus('idle');
                if (errors.woNumber) {
                  setErrors(prev => ({ ...prev, woNumber: null }));
                }
              }}
              onFocus={(e) => e.target.select()}
              onBlur={handleWoNumberBlur}
              onKeyDown={handleWoNumberKeyDown}
              placeholder={woNumberLoading ? 'Generating...' : 'WO-YYYYMMDD-XXXX'}
              disabled={woNumberLoading}
              maxLength={30}
              className={cn(
                "w-full px-3 py-2 pr-9 bg-indusia-surface border rounded-lg text-sm font-mono",
                "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
                errors.woNumber ? "border-red-500"
                  : woNumberStatus === 'available' ? "border-green-500"
                  : "border-indusia-border",
                woNumberLoading && "opacity-60 cursor-not-allowed"
              )}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {woNumberStatus === 'checking' && (
                <Loader2 className="w-4 h-4 animate-spin text-indusia-textMuted" />
              )}
              {woNumberStatus === 'available' && (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              )}
              {woNumberStatus === 'taken' && (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div>
              {errors.woNumber && (
                <p className="text-xs text-red-400">{errors.woNumber}</p>
              )}
              {woNumberStatus === 'available' && !errors.woNumber && (
                <p className="text-xs text-green-400">Available</p>
              )}
            </div>
            <span className={cn(
              "text-xs font-mono",
              woNumber.length >= 30 ? "text-red-400" : woNumber.length >= 25 ? "text-yellow-400" : "text-indusia-textMuted"
            )}>
              {woNumber.length}/30
            </span>
          </div>
        </div>
      )}

      {/* Customer & Board */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Customer <span className="text-red-400">*</span>
          </label>
          <select
            name="customerId"
            value={formData.customerId}
            onChange={handleChange}
            disabled={isEdit}
            className={cn(
              "w-full px-3 py-2 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.customerId ? "border-red-500" : "border-indusia-border",
              isEdit && "opacity-60 cursor-not-allowed"
            )}
          >
            <option value="">Select Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.customerId && (
            <p className="mt-0.5 text-xs text-red-400">{errors.customerId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Board / PCB <span className="text-red-400">*</span>
          </label>
          <select
            name="boardId"
            value={formData.boardId}
            onChange={handleChange}
            disabled={!formData.customerId || isEdit}
            className={cn(
              "w-full px-3 py-2 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.boardId ? "border-red-500" : "border-indusia-border",
              (!formData.customerId || isEdit) && "opacity-60 cursor-not-allowed"
            )}
          >
            <option value="">Select Board</option>
            {filteredBoards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {errors.boardId && (
            <p className="mt-0.5 text-xs text-red-400">{errors.boardId}</p>
          )}
        </div>
      </div>

      {/* Section & Line */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Section
          </label>
          <select
            name="sectionId"
            value={formData.sectionId}
            onChange={handleChange}
            disabled={!formData.customerId}
            className={cn(
              "w-full px-3 py-2 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              "border-indusia-border",
              !formData.customerId && "opacity-60 cursor-not-allowed"
            )}
          >
            <option value="">All Sections</option>
            {filteredSections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Line <span className="text-red-400">*</span>
          </label>
          <select
            name="lineId"
            value={formData.lineId}
            onChange={handleChange}
            disabled={!formData.customerId}
            className={cn(
              "w-full px-3 py-2 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.lineId ? "border-red-500" : "border-indusia-border",
              !formData.customerId && "opacity-60 cursor-not-allowed"
            )}
          >
            <option value="">Select Line</option>
            {filteredLines.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {errors.lineId && (
            <p className="mt-0.5 text-xs text-red-400">{errors.lineId}</p>
          )}
        </div>
      </div>

      {/* Lot Size, Side Count, Due Date, Priority */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Lot Size <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            name="lotSize"
            value={formData.lotSize}
            onChange={handleChange}
            min="1"
            className={cn(
              "w-full px-3 py-1.5 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.lotSize ? "border-red-500" : "border-indusia-border"
            )}
          />
          {errors.lotSize && (
            <p className="mt-0.5 text-xs text-red-400">{errors.lotSize}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Side Count <span className="text-red-400">*</span>
          </label>
          <select
            name="sideCount"
            value={formData.sideCount}
            onChange={handleChange}
            className={cn(
              "w-full px-2 py-1.5 bg-indusia-surface border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.sideCount ? "border-red-500" : "border-indusia-border"
            )}
          >
            <option value={1}>1 - TOP</option>
            <option value={2}>2 - TOP+BTM</option>
          </select>
          {errors.sideCount && (
            <p className="mt-0.5 text-xs text-red-400">{errors.sideCount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Due Date
          </label>
          <input
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            className={cn(
              "w-full px-2 py-1.5 bg-indusia-surface border border-indusia-border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-1">
            Priority
          </label>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className={cn(
              "w-full px-2 py-1.5 bg-indusia-surface border border-indusia-border rounded-lg text-sm",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            )}
          >
            <option value={0}>Normal</option>
            <option value={50}>High</option>
            <option value={100}>Urgent</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-indusia-text mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={1}
          className={cn(
            "w-full px-3 py-2 bg-indusia-surface border border-indusia-border rounded-lg text-sm",
            "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
            "resize-none"
          )}
          placeholder="Optional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-indusia-border">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "px-4 py-2 border border-indusia-border rounded-lg text-sm",
            "text-indusia-textMuted hover:text-indusia-text hover:border-indusia-textMuted",
            "transition-colors"
          )}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "px-4 py-2 bg-indusia-primary text-white rounded-lg text-sm",
            "hover:bg-indusia-primary/90 transition-colors",
            "flex items-center gap-2",
            isLoading && "opacity-60 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default WorkOrderForm;

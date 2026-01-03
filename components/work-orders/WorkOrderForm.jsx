/**
 * Work Order Form
 * Create/Edit work order form with cascading selectors
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMasterData } from '@/hooks/useMasterData';

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
    sideCount: 1,
    dueDate: '',
    priority: 0,
    notes: '',
  });

  const [errors, setErrors] = useState({});

  // Filtered options based on selection
  const [filteredBoards, setFilteredBoards] = useState([]);
  const [filteredLines, setFilteredLines] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);

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
      
      // Get unique sections from filtered lines
      const sectionIds = [...new Set(lines
        .filter(l => l.customerId === formData.customerId)
        .map(l => l.sectionId)
      )];
      setFilteredSections(sections.filter(s => sectionIds.includes(s.id)));
    } else {
      setFilteredBoards([]);
      setFilteredLines([]);
      setFilteredSections([]);
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
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    onSubmit(formData);
  };

  if (masterLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indusia-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-indusia-border">
        <h2 className="text-xl font-display font-bold text-indusia-text">
          {isEdit ? 'Edit Work Order' : 'Create Work Order'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-indusia-textMuted hover:text-indusia-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Customer */}
      <div>
        <label className="block text-sm font-medium text-indusia-text mb-2">
          Customer <span className="text-red-400">*</span>
        </label>
        <select
          name="customerId"
          value={formData.customerId}
          onChange={handleChange}
          disabled={isEdit}
          className={cn(
            "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
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
          <p className="mt-1 text-sm text-red-400">{errors.customerId}</p>
        )}
      </div>

      {/* Board */}
      <div>
        <label className="block text-sm font-medium text-indusia-text mb-2">
          Board / PCB Type <span className="text-red-400">*</span>
        </label>
        <select
          name="boardId"
          value={formData.boardId}
          onChange={handleChange}
          disabled={!formData.customerId || isEdit}
          className={cn(
            "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
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
          <p className="mt-1 text-sm text-red-400">{errors.boardId}</p>
        )}
      </div>

      {/* Section (Optional) */}
      <div>
        <label className="block text-sm font-medium text-indusia-text mb-2">
          Section
        </label>
        <select
          name="sectionId"
          value={formData.sectionId}
          onChange={handleChange}
          disabled={!formData.customerId}
          className={cn(
            "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
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

      {/* Line */}
      <div>
        <label className="block text-sm font-medium text-indusia-text mb-2">
          Production Line <span className="text-red-400">*</span>
        </label>
        <select
          name="lineId"
          value={formData.lineId}
          onChange={handleChange}
          disabled={!formData.customerId}
          className={cn(
            "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
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
          <p className="mt-1 text-sm text-red-400">{errors.lineId}</p>
        )}
      </div>

      {/* Lot Size & Side Count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-2">
            Lot Size <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            name="lotSize"
            value={formData.lotSize}
            onChange={handleChange}
            min="1"
            className={cn(
              "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.lotSize ? "border-red-500" : "border-indusia-border"
            )}
          />
          {errors.lotSize && (
            <p className="mt-1 text-sm text-red-400">{errors.lotSize}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-2">
            Side Count <span className="text-red-400">*</span>
          </label>
          <select
            name="sideCount"
            value={formData.sideCount}
            onChange={handleChange}
            className={cn(
              "w-full px-4 py-3 bg-indusia-surface border rounded-lg",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
              errors.sideCount ? "border-red-500" : "border-indusia-border"
            )}
          >
            <option value={1}>1 - TOP Only</option>
            <option value={2}>2 - TOP + BOTTOM</option>
          </select>
          {errors.sideCount && (
            <p className="mt-1 text-sm text-red-400">{errors.sideCount}</p>
          )}
        </div>
      </div>

      {/* Due Date & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-indusia-text mb-2">
            Due Date
          </label>
          <input
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            className={cn(
              "w-full px-4 py-3 bg-indusia-surface border border-indusia-border rounded-lg",
              "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-indusia-text mb-2">
            Priority
          </label>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className={cn(
              "w-full px-4 py-3 bg-indusia-surface border border-indusia-border rounded-lg",
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
        <label className="block text-sm font-medium text-indusia-text mb-2">
          Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className={cn(
            "w-full px-4 py-3 bg-indusia-surface border border-indusia-border rounded-lg",
            "text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary",
            "resize-none"
          )}
          placeholder="Optional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-indusia-border">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "px-6 py-3 border border-indusia-border rounded-lg",
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
            "px-6 py-3 bg-indusia-primary text-white rounded-lg",
            "hover:bg-indusia-primary/90 transition-colors",
            "flex items-center gap-2",
            isLoading && "opacity-60 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {isEdit ? 'Update' : 'Create'} Work Order
        </button>
      </div>
    </form>
  );
}

export default WorkOrderForm;

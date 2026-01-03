/**
 * Work Order Filter Bar
 * Filter controls for work order list
 */

'use client';

import { useState } from 'react';
import { Search, Filter, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMasterData } from '@/hooks/useMasterData';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

export function WorkOrderFilters({
  filters = {},
  onFilterChange,
  onRefresh,
  loading = false,
}) {
  const { customers, lines } = useMasterData();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (key, value) => {
    onFilterChange({ [key]: value || undefined });
  };

  const handleClear = () => {
    onFilterChange({
      status: undefined,
      customerId: undefined,
      lineId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = filters.status || filters.customerId || filters.lineId || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-4">
      {/* Main Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter */}
        <select
          value={filters.status || ''}
          onChange={(e) => handleChange('status', e.target.value)}
          className={cn(
            "px-4 py-2 bg-indusia-surface border border-indusia-border rounded-lg",
            "text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary",
            "min-w-[140px]"
          )}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Customer Filter */}
        <select
          value={filters.customerId || ''}
          onChange={(e) => handleChange('customerId', e.target.value)}
          className={cn(
            "px-4 py-2 bg-indusia-surface border border-indusia-border rounded-lg",
            "text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary",
            "min-w-[160px]"
          )}
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Line Filter */}
        <select
          value={filters.lineId || ''}
          onChange={(e) => handleChange('lineId', e.target.value)}
          className={cn(
            "px-4 py-2 bg-indusia-surface border border-indusia-border rounded-lg",
            "text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary",
            "min-w-[140px]"
          )}
        >
          <option value="">All Lines</option>
          {lines.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Advanced Filter Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "px-4 py-2 border rounded-lg text-sm",
            "flex items-center gap-2 transition-colors",
            showAdvanced 
              ? "bg-indusia-primary/20 border-indusia-primary text-indusia-primary"
              : "border-indusia-border text-indusia-textMuted hover:text-indusia-text"
          )}
        >
          <Filter className="w-4 h-4" />
          More Filters
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            "p-2 border border-indusia-border rounded-lg",
            "text-indusia-textMuted hover:text-indusia-text hover:border-indusia-textMuted",
            "transition-colors",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className={cn(
              "px-3 py-2 text-sm text-red-400 hover:text-red-300",
              "flex items-center gap-1 transition-colors"
            )}
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="flex items-center gap-3 p-4 bg-indusia-bg rounded-lg border border-indusia-border">
          <div className="flex items-center gap-2">
            <label className="text-sm text-indusia-textMuted whitespace-nowrap">
              Date Range:
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              className={cn(
                "px-3 py-2 bg-indusia-surface border border-indusia-border rounded-lg",
                "text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary"
              )}
            />
            <span className="text-indusia-textMuted">to</span>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              className={cn(
                "px-3 py-2 bg-indusia-surface border border-indusia-border rounded-lg",
                "text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderFilters;

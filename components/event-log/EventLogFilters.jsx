import { useState } from 'react';
import { Search, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import DateRangePicker from '@/components/common/DateRangePicker';
import { useToast } from '@/hooks/useToast';

const SECTIONS = ['SMT', 'MI', 'Testing', 'FATP'];
const ROLES = ['operator', 'manager', 'engineer', 'superadmin'];

export default function EventLogFilters({
  filters,
  onFiltersChange,
  onReset,
  onExport,
  eventTypes,
  sources,
  totalCount,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { showToast } = useToast();

  const handleEventTypeToggle = (type) => {
    const newTypes = filters.eventTypes.includes(type)
      ? filters.eventTypes.filter((t) => t !== type)
      : [...filters.eventTypes, type];
    onFiltersChange({ eventTypes: newTypes });
  };

  const handleExport = () => {
    const count = onExport();
    showToast(`Exported ${count} events to CSV`);
  };

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-indusia-bg transition-colors"
      >
        <h3 className="text-sm font-semibold text-indusia-text">
          Filters {totalCount !== undefined && `(${totalCount} events)`}
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-indusia-textMuted" />
        ) : (
          <ChevronDown className="w-5 h-5 text-indusia-textMuted" />
        )}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-indusia-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-indusia-textMuted mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ search: e.target.value })}
                  placeholder="Search by user, type, details..."
                  className="w-full pl-10 pr-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indusia-textMuted" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-indusia-textMuted mb-1">
                Role
              </label>
              <select
                value={filters.role || ''}
                onChange={(e) => onFiltersChange({ role: e.target.value || null })}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
              >
                <option value="">All Roles</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-indusia-textMuted mb-1">
                Section
              </label>
              <select
                value={filters.section || ''}
                onChange={(e) => onFiltersChange({ section: e.target.value || null })}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
              >
                <option value="">All Sections</option>
                {SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-indusia-textMuted mb-1">
                Source
              </label>
              <select
                value={filters.source || ''}
                onChange={(e) => onFiltersChange({ source: e.target.value || null })}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
              >
                <option value="">All Sources</option>
                {Object.values(sources).map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-indusia-textMuted mb-1">
                Date Range
              </label>
              <DateRangePicker
                from={filters.from}
                to={filters.to}
                onFromChange={(value) => onFiltersChange({ from: value })}
                onToChange={(value) => onFiltersChange({ to: value })}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-indusia-textMuted mb-2">
              Event Types
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(eventTypes).map(([key, value]) => {
                const isSelected = filters.eventTypes.includes(value);
                return (
                  <button
                    key={key}
                    onClick={() => handleEventTypeToggle(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indusia-primary text-white'
                        : 'bg-indusia-bg text-indusia-textMuted hover:bg-indusia-surfaceMuted border border-indusia-border'
                    }`}
                  >
                    {key.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-indusia-border">
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indusia-primary text-white hover:opacity-90 transition-opacity flex items-center gap-2 ml-auto"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

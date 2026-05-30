import { Calendar } from 'lucide-react';

export default function DateRangePicker({ from, to, onFromChange, onToChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-indusia-textMuted mb-1">
          From
        </label>
        <div className="relative">
          <input
            type="date"
            value={from || ''}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          />
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indusia-textMuted pointer-events-none" />
        </div>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-medium text-indusia-textMuted mb-1">
          To
        </label>
        <div className="relative">
          <input
            type="date"
            value={to || ''}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
          />
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indusia-textMuted pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

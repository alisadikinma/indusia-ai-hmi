import { BellOff, CheckCircle } from 'lucide-react';

export default function NotificationEmptyState({ hasFilters = false }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {hasFilters ? (
        <BellOff className="w-12 h-12 text-indusia-textMuted mb-4" />
      ) : (
        <CheckCircle className="w-12 h-12 text-indusia-pass mb-4" />
      )}
      <h3 className="text-sm font-semibold text-indusia-text mb-2">
        {hasFilters ? 'No notifications found' : "You're all caught up!"}
      </h3>
      <p className="text-xs text-indusia-textMuted max-w-xs">
        {hasFilters
          ? 'Try adjusting your filters to see more notifications.'
          : "We'll let you know if something needs your attention."}
      </p>
    </div>
  );
}

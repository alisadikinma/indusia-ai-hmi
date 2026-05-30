import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  ctaLabel,
  onCtaClick,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 bg-indusia-surfaceMuted rounded-full mb-4">
        <Icon className="w-12 h-12 text-indusia-textMuted" />
      </div>
      <h3 className="text-lg font-semibold text-indusia-text mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-indusia-textMuted mb-6 max-w-md">
          {description}
        </p>
      )}
      {ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

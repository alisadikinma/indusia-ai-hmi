import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}) {
  if (!isOpen) return null;

  const variantStyles = {
    default: 'bg-indusia-primary hover:opacity-90',
    danger: 'bg-indusia-fail hover:opacity-90',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-indusia-text">{title}</h3>
          <button
            onClick={onCancel}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {variant === 'danger' && (
            <div className="w-12 h-12 rounded-full bg-indusia-fail/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-indusia-fail" />
            </div>
          )}
          <p className="text-sm text-indusia-text text-center">{message}</p>
        </div>

        <div className="px-6 py-4 border-t border-indusia-border flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-opacity ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

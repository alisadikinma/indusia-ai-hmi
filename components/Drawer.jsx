import { X } from 'lucide-react';

export default function Drawer({ isOpen, onClose, title, children, width = 'max-w-2xl' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-indusia-surface h-full ${width} w-full shadow-2xl border-l border-indusia-border flex flex-col`}>
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-indusia-text">{title}</h3>
          <button
            onClick={onClose}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

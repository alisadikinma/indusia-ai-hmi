import { Info, X } from 'lucide-react';

export default function OverlayLegend({ onClose }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] max-w-lg">
      <div className="bg-indusia-surface border-2 border-indusia-primary rounded-xl shadow-2xl p-4 flex items-start gap-4">
        <div className="flex-shrink-0 p-2 bg-indusia-primary/20 rounded-lg">
          <Info className="w-5 h-5 text-indusia-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-indusia-text mb-1">
            Highlight Mode Active
          </h4>
          <p className="text-xs text-indusia-textMuted mb-2">
            Key areas are highlighted to help you understand this screen.
          </p>
          <div className="flex items-center gap-2 text-xs text-indusia-textMuted">
            <kbd className="px-2 py-1 bg-indusia-bg border border-indusia-border rounded font-mono">
              Esc
            </kbd>
            <span>or</span>
            <kbd className="px-2 py-1 bg-indusia-bg border border-indusia-border rounded font-mono">
              F1
            </kbd>
            <span>to exit</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 text-indusia-textMuted hover:text-indusia-text transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

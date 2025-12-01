'use client';

import { X, Keyboard, FileText, Eye } from 'lucide-react';
import { useHelpOverlay } from '@/hooks/useHelpOverlay';
import { useI18n } from '@/hooks/useI18n';
import ShortcutCheatSheet from './ShortcutCheatSheet';
import HelpSectionCard from './HelpSectionCard';
import OverlayLegend from './OverlayLegend';

export default function HelpOverlay() {
  const { isOpen, mode, currentContext, closeHelp, setMode } = useHelpOverlay();
  const { t } = useI18n();

  if (!isOpen) return null;

  const modes = [
    { id: 'shortcuts', label: t('help.shortcuts'), icon: Keyboard },
    { id: 'process', label: t('help.processHelp'), icon: FileText },
    { id: 'highlight', label: t('help.highlightMode'), icon: Eye },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60] transition-opacity"
        onClick={closeHelp}
      />

      {mode === 'highlight' ? (
        <OverlayLegend onClose={closeHelp} />
      ) : (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
          <div
            className="w-full max-w-4xl max-h-[85vh] bg-indusia-surface rounded-2xl shadow-2xl border border-indusia-border flex flex-col pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-indusia-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-indusia-text mb-2">
                    {t('help.title')}
                  </h2>
                  <p className="text-sm text-indusia-textMuted">
                    {t('help.description')}
                  </p>
                </div>
                <button
                  onClick={closeHelp}
                  className="p-2 text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {modes.map((m) => {
                  const Icon = m.icon;
                  const isActive = mode === m.id;

                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-indusia-primary text-white'
                          : 'bg-indusia-surfaceMuted text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-border'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {mode === 'shortcuts' && (
                <ShortcutCheatSheet currentContext={currentContext} />
              )}
              {mode === 'process' && <HelpSectionCard />}
              {mode === 'highlight' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="w-16 h-16 text-indusia-textMuted mb-4" />
                  <h3 className="text-lg font-semibold text-indusia-text mb-2">
                    {t('help.highlightMode')}
                  </h3>
                  <p className="text-sm text-indusia-textMuted max-w-md">
                    {t('help.highlightDescription')}
                  </p>
                  <button
                    onClick={closeHelp}
                    className="mt-6 px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    {t('help.activateHighlight')}
                  </button>
                </div>
              )}
            </div>

            <div className="px-8 py-4 border-t border-indusia-border bg-indusia-surfaceMuted">
              <div className="flex items-center justify-between text-xs text-indusia-textMuted">
                <div className="flex items-center gap-2">
                  <span>{t('help.pressF1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{t('help.currentContext')}:</span>
                  <span className="px-2 py-1 bg-indusia-primary/20 text-indusia-primary rounded font-medium">
                    {currentContext}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

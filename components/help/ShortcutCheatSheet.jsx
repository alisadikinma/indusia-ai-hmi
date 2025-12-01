const shortcuts = {
  Global: [
    { key: 'F1', description: 'Open Help & Shortcuts' },
    { key: 'Esc', description: 'Close modals and overlays' },
  ],
  HMI: [
    { key: 'Space', description: 'Pause/Resume live feed' },
    { key: 'F', description: 'Toggle fullscreen image viewer' },
    { key: 'O', description: 'Open False Call Override modal' },
    { key: '← / →', description: 'Navigate previous/next defect' },
    { key: 'Enter', description: 'Confirm override submission' },
  ],
  Manager: [
    { key: '↑ / ↓', description: 'Navigate items in queue' },
    { key: 'Enter', description: 'Open selected override detail' },
    { key: 'A', description: 'Approve override' },
    { key: 'R', description: 'Reject override' },
    { key: 'Esc', description: 'Close detail drawer' },
  ],
  Engineer: [
    { key: 'N', description: 'Create new item (customer/line/board)' },
    { key: 'Ctrl + S', description: 'Save changes' },
    { key: 'Delete', description: 'Delete selected item (with confirmation)' },
    { key: 'Ctrl + F', description: 'Search master data' },
  ],
  SuperAdmin: [
    { key: 'N', description: 'Create new user' },
    { key: 'Ctrl + S', description: 'Save changes' },
    { key: 'Delete', description: 'Delete/disable user (with confirmation)' },
    { key: 'Ctrl + R', description: 'Reset user password' },
  ],
};

export default function ShortcutCheatSheet({ currentContext }) {
  const contextOrder = currentContext === 'Global'
    ? ['Global', 'HMI', 'Manager', 'Engineer', 'SuperAdmin']
    : [currentContext, 'Global', 'HMI', 'Manager', 'Engineer', 'SuperAdmin'].filter(
        (ctx, index, self) => self.indexOf(ctx) === index
      );

  return (
    <div className="space-y-6">
      {contextOrder.map((context) => {
        const contextShortcuts = shortcuts[context];
        if (!contextShortcuts || contextShortcuts.length === 0) return null;

        return (
          <div key={context}>
            <h3 className="text-sm font-semibold text-indusia-text mb-3 flex items-center gap-2">
              {context === currentContext && (
                <span className="w-2 h-2 bg-indusia-primary rounded-full" />
              )}
              {context}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {contextShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 px-4 py-3 bg-indusia-surfaceMuted rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-[120px]">
                    {shortcut.key.split(' / ').map((key, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-indusia-textMuted">/</span>}
                        <kbd className="px-2 py-1 bg-indusia-bg border border-indusia-border rounded text-xs font-mono text-indusia-text shadow-sm">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-indusia-textMuted flex-1">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

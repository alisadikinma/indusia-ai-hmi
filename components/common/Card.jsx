export default function Card({ title, subtitle, children, actions }) {
  return (
    <div className="bg-indusia-surface rounded-xl shadow-lg border border-indusia-border overflow-hidden">
      {(title || subtitle || actions) && (
        <div className="px-6 py-4 border-b border-indusia-border flex items-start justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-indusia-text">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-indusia-textMuted mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="px-6 py-6">
        {children}
      </div>
    </div>
  );
}

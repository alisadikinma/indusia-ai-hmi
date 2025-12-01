export default function StatsGrid({ items = [] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="bg-indusia-surfaceMuted rounded-lg px-6 py-4 border border-indusia-border"
        >
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-2">
            {item.label}
          </p>
          <p className="text-3xl font-bold text-indusia-text">
            {item.value}
          </p>
          {item.hint && (
            <p className="text-xs text-indusia-textMuted mt-1">
              {item.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

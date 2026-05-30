export default function TableSkeleton({ rows = 5, columns = 6 }) {
  return (
    <div className="space-y-3">
      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-hidden">
        <div className="px-6 py-3 bg-indusia-surfaceMuted border-b border-indusia-border">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-indusia-border rounded animate-pulse"
              />
            ))}
          </div>
        </div>

        <div className="divide-y divide-indusia-border">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="h-4 bg-indusia-surfaceMuted rounded animate-pulse"
                    style={{ animationDelay: `${(rowIndex * columns + colIndex) * 50}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

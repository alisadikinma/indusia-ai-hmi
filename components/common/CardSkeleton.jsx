export default function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-indusia-surface rounded-xl border border-indusia-border p-6"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indusia-surfaceMuted rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-indusia-surfaceMuted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-indusia-surfaceMuted rounded animate-pulse w-1/2" />
              </div>
            </div>
            <div className="h-8 bg-indusia-surfaceMuted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-20 bg-zinc-800 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="aspect-square bg-zinc-800 animate-pulse" />
      ))}
    </div>
  );
}

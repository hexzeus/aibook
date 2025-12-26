export function SkeletonLine({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`bg-white/5 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`}>
      <div className="space-y-4">
        <SkeletonLine width="60%" height="1.5rem" />
        <SkeletonLine width="100%" height="1rem" />
        <SkeletonLine width="90%" height="1rem" />
        <SkeletonLine width="80%" height="1rem" />
      </div>
    </div>
  );
}

export function SkeletonBookCard() {
  return (
    <div className="card group cursor-pointer">
      <div className="aspect-[2/3] bg-white/5 rounded-xl mb-4 animate-pulse" />
      <div className="space-y-2">
        <SkeletonLine width="80%" height="1.25rem" />
        <SkeletonLine width="60%" height="0.875rem" />
        <div className="flex items-center gap-2 mt-3">
          <SkeletonLine width="4rem" height="0.75rem" />
          <SkeletonLine width="4rem" height="0.75rem" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
          <SkeletonLine width="3rem" height="3rem" className="rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="40%" height="1rem" />
            <SkeletonLine width="60%" height="0.875rem" />
          </div>
          <SkeletonLine width="5rem" height="2rem" className="rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-center gap-4">
            <SkeletonLine width="3rem" height="3rem" className="rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="40%" height="0.875rem" />
              <SkeletonLine width="60%" height="1.5rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page-container">
      <div className="mb-8">
        <SkeletonLine width="15rem" height="2.5rem" className="mb-2" />
        <SkeletonLine width="25rem" height="1.25rem" />
      </div>
      <SkeletonStats />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBookCard key={i} />
        ))}
      </div>
    </div>
  );
}

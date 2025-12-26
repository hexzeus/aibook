interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  lines?: number;
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = 'bg-white/5 animate-pulse';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses.text}`}
            style={{
              ...style,
              width: i === lines - 1 ? '80%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Specific skeleton components for common use cases
export function BookCardSkeleton() {
  return (
    <div className="card">
      <div className="flex gap-4">
        <Skeleton variant="rectangular" width="120px" height="160px" />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" width="70%" height="24px" />
          <Skeleton variant="text" lines={2} />
          <div className="flex gap-4 mt-4">
            <Skeleton variant="text" width="80px" />
            <Skeleton variant="text" width="100px" />
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton variant="rectangular" width="100px" height="36px" />
            <Skeleton variant="rectangular" width="100px" height="36px" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg bg-white/5">
          <Skeleton variant="text" width="60%" height="16px" className="mb-2" />
          <Skeleton variant="text" width="40%" height="12px" />
        </div>
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton variant="circular" width="40px" height="40px" />
            <Skeleton variant="text" width="120px" height="20px" />
          </div>
          <Skeleton variant="text" width="80px" height="32px" />
        </div>
      ))}
    </div>
  );
}

export function LibraryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}

interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'row' | 'stat';
}

export default function LoadingSkeleton({ count = 6, type = 'card' }: LoadingSkeletonProps) {
  if (type === 'stat') {
    return (
      <div className="skeleton-stats">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-stat">
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-line skeleton-line-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'row') {
    return (
      <div className="skeleton-rows">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-line skeleton-line-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-tile skeleton-tile">
          <div className="skeleton-image" />
          <div className="skeleton-info">
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-line skeleton-line-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

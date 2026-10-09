import { cn } from '../../utils/cn';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full animate-pulse', className)}>
      <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`header-${index}`} className="h-4 rounded bg-surface-container-low" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="mb-2 grid gap-2 border-b border-outline-variant py-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-5 rounded bg-surface-container-low"
              style={{ width: `${80 + ((rowIndex + colIndex) % 3) * 10}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

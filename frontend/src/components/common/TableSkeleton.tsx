import { cn } from '../../utils/cn';
import { Skeleton } from '../ui/Skeleton';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'overflow-hidden rounded-2xl bg-surface-container-lowest shadow-card',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-outline-variant px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={10} width={i === 0 ? 80 : 60} rounded="sm" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-outline-variant/60 px-4 py-4 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              height={14}
              width={colIndex === 0 ? '40%' : '20%'}
              rounded="sm"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
import { cn } from '../../utils/cn';
import { Skeleton } from '../ui/Skeleton';

export interface PageSkeletonProps {
  className?: string;
}

export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <Skeleton height={28} width={220} rounded="lg" />
        <Skeleton height={40} width={120} rounded="xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={92} rounded="xl" />
        ))}
      </div>
      <Skeleton height={320} rounded="xl" />
    </div>
  );
}
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface PageSkeletonProps {
  className?: string;
  children?: ReactNode;
}

export function PageSkeleton({ className, children }: PageSkeletonProps) {
  return (
    <div className={cn('animate-pulse space-y-4', className)}>
      <div className="h-8 w-56 rounded bg-surface-container-low" />
      <div className="h-4 w-72 rounded bg-surface-container-low" />
      <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
        <div className="h-10 w-full rounded bg-surface-container-low" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-14 rounded bg-surface-container-low" />
          <div className="h-14 rounded bg-surface-container-low" />
          <div className="h-14 rounded bg-surface-container-low" />
        </div>
      </div>
      {children}
    </div>
  );
}

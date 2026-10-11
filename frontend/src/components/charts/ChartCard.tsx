import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { ErrorBanner } from '../common/ErrorBanner';
import { EmptyState } from '../common/EmptyState';

export interface ChartCardProps {
  title: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  height?: number;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  actions,
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  height = 280,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        {actions}
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton height={height} rounded="xl" />
      ) : isEmpty ? (
        <EmptyState icon="bar_chart" title="No data for this period" />
      ) : (
        children
      )}
    </Card>
  );
}

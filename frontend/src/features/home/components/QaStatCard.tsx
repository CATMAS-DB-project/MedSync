import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../utils/cn';

export type QaStatTone = 'success' | 'error' | 'warning' | 'neutral';

export interface QaStatCardProps {
  label: string;
  value: string;
  description?: string;
  dotTone?: QaStatTone;
  valueTone?: QaStatTone;
  onClick?: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const DOT_CLASSES: Record<QaStatTone, string> = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  neutral: 'bg-outline',
};

const VALUE_TONE_CLASSES: Record<QaStatTone, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  neutral: 'text-on-surface',
};

export function QaStatCard({
  label,
  value,
  description,
  dotTone,
  valueTone,
  onClick,
  loading = false,
  error = null,
  onRetry,
}: QaStatCardProps) {
  if (loading) {
    return <Skeleton height={116} rounded="xl" />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
            {label}
          </span>
          <IconButton
            icon="refresh"
            size="sm"
            aria-label={`Retry ${label}`}
            onClick={onRetry ?? (() => undefined)}
          />
        </div>
        <span className="text-display-sm text-on-surface-variant">—</span>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {dotTone && (
          <span
            aria-hidden="true"
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASSES[dotTone])}
          />
        )}
        <span
          className={cn(
            'text-display-sm font-bold',
            valueTone ? VALUE_TONE_CLASSES[valueTone] : 'text-on-surface',
          )}
        >
          {value}
        </span>
      </div>

      {description && (
        <p className="text-label-md text-on-surface-variant">{description}</p>
      )}
    </>
  );

  const baseClass =
    'flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 text-left shadow-card';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClass,
          'transition-all duration-150',
          'hover:-translate-y-0.5 hover:shadow-popover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'inbox',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      {description && <p className="mt-2 max-w-md text-body-sm text-on-surface-variant">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

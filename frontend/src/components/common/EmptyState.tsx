import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from '../ui/Icon';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-body-md font-semibold text-on-surface">{title}</p>
      {description && (
        <p className="max-w-sm text-body-sm text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  delta?: {
    value: string;
    direction: 'up' | 'down' | 'flat';
  };
  description?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const DELTA_CLASSES = {
  up: 'text-success',
  down: 'text-error',
  flat: 'text-on-surface-variant',
} as const;

const DELTA_ICONS = {
  up: 'trending_up',
  down: 'trending_down',
  flat: 'trending_flat',
} as const;

export function StatCard({
  label,
  value,
  icon,
  delta,
  description,
  onClick,
  className,
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="text-display-sm font-bold text-on-surface">{value}</span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-label-md font-semibold',
              DELTA_CLASSES[delta.direction],
            )}
          >
            <Icon name={DELTA_ICONS[delta.direction]} size={16} />
            {delta.value}
          </span>
        )}
      </div>

      {description !== undefined && description !== null && (
        <p className="text-label-md text-on-surface-variant">{description}</p>
      )}
    </>
  );

  const baseClasses = cn(
    'flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 text-left',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClasses,
          'shadow-card transition-all duration-150',
          'hover:-translate-y-0.5 hover:shadow-popover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={cn(baseClasses, 'shadow-card')}>{content}</div>;
}

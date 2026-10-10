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

export function StatCard({ label, value, icon, delta, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card',
        className,
      )}
    >
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
          <span className={cn('inline-flex items-center gap-1 text-label-md font-semibold', DELTA_CLASSES[delta.direction])}>
            <Icon name={DELTA_ICONS[delta.direction]} size={16} />
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
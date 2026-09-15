import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'secondary';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Fully rounded pill shape instead of the default 4px radius. */
  pill?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-tertiary/10 text-tertiary',
  error: 'bg-error/10 text-error',
  secondary: 'bg-secondary/10 text-secondary',
  neutral: 'bg-outline-variant/40 text-on-surface-variant',
};

export function Badge({ children, tone = 'neutral', pill = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium leading-4',
        pill ? 'rounded-full' : 'rounded',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

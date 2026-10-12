import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'secondary' | 'info';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  pill?: boolean;
  dot?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-info-container text-on-info-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-outline',
};

export function Badge({
  children,
  tone = 'neutral',
  pill = false,
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-label-md leading-4',
        pill ? 'rounded-full' : 'rounded-md',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} />
      )}
      {children}
    </span>
  );
}
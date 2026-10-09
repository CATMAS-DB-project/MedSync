import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'secondary';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  pill?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
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

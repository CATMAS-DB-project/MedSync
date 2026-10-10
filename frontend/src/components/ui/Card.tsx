import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  padding?: CardPadding;
  className?: string;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  title,
  action,
  padding = 'md',
  className,
}: CardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl bg-surface-container-lowest shadow-card',
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
          <h2 className="truncate text-headline-sm font-semibold text-on-surface">{title}</h2>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={PADDING_CLASSES[padding]}>{children}</div>
    </section>
  );
}
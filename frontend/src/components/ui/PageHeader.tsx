import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  title,
  actions,
  backTo,
  backLabel = 'Back',
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Icon name="arrow_back" size={18} />
            {backLabel}
          </Link>
        )}
        <h1 className="truncate text-display-sm text-on-surface">{title}</h1>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
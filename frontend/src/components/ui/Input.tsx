import type { InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: string;
}

export function Input({ label, error, icon, className, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name ?? makeId('input');
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(
            'w-full h-9 px-3 border border-outline-variant rounded-md bg-surface text-body-md text-on-surface placeholder:text-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:border-outline-variant',
            icon && 'pl-8',
            error && 'border-error focus-visible:ring-error',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <span id={errorId} className="text-body-sm text-error">{error}</span>}
    </div>
  );
}

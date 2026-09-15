import type { InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Material Symbols icon name shown inside the field, on the left. */
  icon?: string;
}

export function Input({ label, error, icon, className, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
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
          className={cn(
            'w-full h-9 px-3 border border-outline-variant rounded bg-surface text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all',
            icon && 'pl-8',
            error && 'border-error focus:border-error focus:ring-error',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <span className="text-body-sm text-error">{error}</span>}
    </div>
  );
}

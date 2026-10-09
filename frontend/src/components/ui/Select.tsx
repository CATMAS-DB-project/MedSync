import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name ?? makeId('select');
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(
            'w-full h-9 pl-3 pr-8 border border-outline-variant rounded-md bg-surface text-body-md text-on-surface appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:border-outline-variant disabled:cursor-not-allowed',
            error && 'border-error focus-visible:ring-error',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">
          arrow_drop_down
        </span>
      </div>
      {error && <span id={errorId} className="text-body-sm text-error">{error}</span>}
    </div>
  );
}

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Rendered as a disabled, hidden-by-default option — shown until a real value is picked. */
  placeholder?: string;
  options?: SelectOption[];
  children?: ReactNode;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    hint,
    placeholder,
    options,
    children,
    className,
    containerClassName,
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-label-md font-medium text-on-surface">
          {label}
        </label>
      )}

      <div
        className={cn(
          'relative flex h-10 items-center rounded-xl bg-surface-container-lowest',
          'border border-outline-variant',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          error && 'border-error focus-within:border-error focus-within:ring-error/20',
        )}
      >
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'h-full w-full cursor-pointer appearance-none bg-transparent pl-3 pr-9 text-body-sm text-on-surface',
            'border-0 focus:border-0 focus:ring-0',
            'disabled:cursor-not-allowed disabled:text-on-surface-variant',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <Icon
          name="expand_more"
          size={18}
          className="pointer-events-none absolute right-3 text-on-surface-variant"
        />
      </div>

      {error ? (
        <p id={errorId} className="text-label-md text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-label-md text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const checkboxId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 text-body-sm text-on-surface select-none',
          rest.disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          id={checkboxId}
          ref={ref}
          type="checkbox"
          className={cn(
            'h-4 w-4 rounded border-outline-variant text-primary',
            'focus:ring-2 focus:ring-primary/20 focus:ring-offset-0',
            'transition-colors',
            error && 'border-error',
            className,
          )}
          {...rest}
        />
        {label && <span>{label}</span>}
      </label>
      {error && <p className="text-label-md text-error">{error}</p>}
    </div>
  );
});
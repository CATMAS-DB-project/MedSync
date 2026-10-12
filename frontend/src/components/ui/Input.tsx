import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string;
  rightAdornment?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, rightAdornment, className, containerClassName, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const hasRightAdornment = rightAdornment !== undefined && rightAdornment !== null;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-label-md font-medium text-on-surface">
          {label}
        </label>
      )}

      <div
        className={cn(
          'relative flex h-10 items-center rounded-xl bg-surface-container-lowest',
          'border border-outline-variant',
          'transition-shadow duration-150',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          error && 'border-error focus-within:border-error focus-within:ring-error/20',
        )}
      >
        {icon && (
          <Icon
            name={icon}
            size={18}
            className="ml-3 shrink-0 text-on-surface-variant"
          />
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'h-full w-full flex-1 bg-transparent px-3 text-body-sm text-on-surface',
            'placeholder:text-on-surface-variant/60',
            'border-0 focus:border-0 focus:ring-0',
            'disabled:cursor-not-allowed disabled:text-on-surface-variant',
            icon ? 'pl-2' : undefined,
            hasRightAdornment ? 'pr-10' : undefined,
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {hasRightAdornment && (
          <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
            {rightAdornment}
          </span>
        )}
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
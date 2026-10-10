import type { TextareaHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, className, containerClassName, id, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const errorId = error ? `${areaId}-error` : undefined;
  const hintId = hint ? `${areaId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={areaId} className="text-label-md font-medium text-on-surface">
          {label}
        </label>
      )}

      <textarea
        id={areaId}
        ref={ref}
        rows={rows}
        className={cn(
          'w-full resize-y rounded-xl bg-surface-container-lowest px-3 py-2.5 text-body-sm text-on-surface',
          'border border-outline-variant placeholder:text-on-surface-variant/60',
          'transition-shadow duration-150',
          'focus:border-primary focus:ring-2 focus:ring-primary/20',
          'disabled:cursor-not-allowed disabled:text-on-surface-variant',
          error && 'border-error focus:border-error focus:ring-error/20',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />

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
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className, id, rows = 4, ...rest }: TextAreaProps) {
  const textareaId = id ?? rest.name ?? makeId('textarea');
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          'w-full px-3 py-2 border border-outline-variant rounded-md bg-surface text-body-md text-on-surface placeholder:text-outline resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:border-outline-variant',
          error && 'border-error focus-visible:ring-error',
          className,
        )}
        {...rest}
      />
      {error && <span id={errorId} className="text-body-sm text-error">{error}</span>}
    </div>
  );
}

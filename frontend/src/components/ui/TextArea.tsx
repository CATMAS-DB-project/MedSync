import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className, id, rows = 4, ...rest }: TextAreaProps) {
  const textareaId = id ?? rest.name;
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
        className={cn(
          'w-full px-3 py-2 border border-outline-variant rounded bg-surface text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y',
          error && 'border-error focus:border-error focus:ring-error',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-body-sm text-error">{error}</span>}
    </div>
  );
}

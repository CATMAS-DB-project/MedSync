import type { InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className, id, ...rest }: CheckboxProps) {
  const checkboxId = id ?? rest.name;
  return (
    <label htmlFor={checkboxId} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        id={checkboxId}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-outline-variant text-primary focus:ring-1 focus:ring-primary cursor-pointer',
          className,
        )}
        {...rest}
      />
      {label && <span className="text-body-md text-on-surface">{label}</span>}
    </label>
  );
}

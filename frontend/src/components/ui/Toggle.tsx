import { useId } from 'react';
import { cn } from '../../utils/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className,
}: ToggleProps) {
  const autoId = useId();
  const toggleId = id ?? autoId;

  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      {(label || description) && (
        <label htmlFor={toggleId} className="flex flex-col select-none">
          {label && <span className="text-body-sm font-medium text-on-surface">{label}</span>}
          {description && (
            <span className="mt-0.5 text-label-md text-on-surface-variant">{description}</span>
          )}
        </label>
      )}

      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-surface-container-highest',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md',
            'transition-transform duration-200 ease-out',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
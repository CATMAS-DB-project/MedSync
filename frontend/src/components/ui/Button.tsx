import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  isLoading?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90 disabled:bg-surface-container-low disabled:text-on-surface-variant',
  secondary:
    'border border-primary bg-transparent text-primary hover:bg-primary-container/30 disabled:border-outline-variant disabled:bg-surface-container-low disabled:text-on-surface-variant',
  ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-high disabled:text-on-surface-variant',
  danger: 'bg-error text-on-error hover:bg-error/90 disabled:bg-error-container disabled:text-on-error-container',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-label-md rounded-md',
  md: 'h-9 px-4 text-label-md rounded-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const hasIconOnly = !!icon && !children;
  const computedAriaLabel = hasIconOnly ? rest['aria-label'] ?? 'Action' : rest['aria-label'];

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-label-md font-medium transition-colors duration-150 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled || isLoading}
      aria-label={computedAriaLabel}
      {...rest}
    >
      {isLoading ? (
        <Icon name="progress_activity" className="animate-spin" size={18} />
      ) : (
        icon && <Icon name={icon} size={18} />
      )}
      {children}
    </button>
  );
}

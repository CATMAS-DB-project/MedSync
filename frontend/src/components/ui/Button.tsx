import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material Symbols icon name to render before the label. */
  icon?: string;
  isLoading?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container text-white hover:opacity-90 disabled:opacity-50',
  secondary:
    'bg-transparent border border-primary text-primary hover:bg-surface-container disabled:opacity-50',
  ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50',
  danger: 'bg-error text-on-error hover:opacity-90 disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-label-md',
  md: 'h-9 px-4 text-label-md',
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
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-label-md font-medium transition-colors duration-150 ease-in-out cursor-pointer disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled || isLoading}
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

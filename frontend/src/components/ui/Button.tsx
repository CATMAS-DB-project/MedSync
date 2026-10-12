import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  isLoading?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/95 shadow-sm ' +
    'disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none',
  secondary:
    'bg-surface-container-lowest text-primary border border-outline-variant hover:bg-primary-container hover:border-primary/40 ' +
    'disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:border-outline-variant',
  ghost:
    'bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface ' +
    'disabled:text-on-surface-variant/60',
  danger:
    'bg-error text-on-error hover:bg-error/90 active:bg-error/95 shadow-sm ' +
    'disabled:bg-error-container disabled:text-on-error-container disabled:shadow-none',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9  px-3   text-label-md gap-1.5 rounded-lg',
  md: 'h-10 px-4   text-body-sm gap-2   rounded-xl',
  lg: 'h-11 px-5   text-body-md gap-2   rounded-xl',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 18 };

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !!icon && !children;
  const ariaLabel = rest['aria-label'] ?? (iconOnly ? 'Action' : undefined);

  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        iconOnly && (size === 'sm' ? 'w-9 px-0' : size === 'md' ? 'w-10 px-0' : 'w-11 px-0'),
        className,
      )}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <Icon name="progress_activity" size={ICON_SIZE[size]} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={ICON_SIZE[size]} />
      )}
      {children}
    </button>
  );
}
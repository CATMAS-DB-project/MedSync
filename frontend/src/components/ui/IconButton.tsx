import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export type IconButtonVariant = 'ghost' | 'filled' | 'danger';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: IconButtonVariant;
  /** Accessible label; required since the button has no visible text. */
  'aria-label': string;
  size?: number;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'text-on-surface-variant hover:bg-surface-container-low',
  filled: 'text-primary bg-primary-fixed hover:opacity-90',
  danger: 'text-error hover:bg-error-container',
};

export function IconButton({
  icon,
  variant = 'ghost',
  size = 20,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center p-2 rounded-full transition-colors duration-150 ease-in-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export type IconButtonVariant = 'ghost' | 'solid' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  'aria-label': string;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  solid:
    'bg-primary text-on-primary hover:bg-primary/90 shadow-sm',
  outline:
    'bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-high hover:text-on-surface',
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-11 w-11 rounded-xl',
};

const ICON_SIZE: Record<IconButtonSize, number> = { sm: 16, md: 20, lg: 22 };

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
    </button>
  );
}
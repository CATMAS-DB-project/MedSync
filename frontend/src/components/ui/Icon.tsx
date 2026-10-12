import { cn } from '../../utils/cn';

export interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
}

export function Icon({
  name,
  size = 20,
  filled = false,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: IconProps) {
  const decorative = ariaLabel ? false : ariaHidden ?? true;

  return (
    <span
      className={cn('material-symbols-outlined', filled && 'icon-fill', className)}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden={decorative || undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      {name}
    </span>
  );
}
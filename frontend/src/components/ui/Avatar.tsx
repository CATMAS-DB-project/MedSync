import { cn } from '../../utils/cn';
import { getInitials } from '../../utils/formatters';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-label-md',
  md: 'h-10 w-10 text-body-sm',
  lg: 'h-12 w-12 text-body-md',
};

const PALETTE = [
  'bg-primary-container text-on-primary-container',
  'bg-secondary-container text-on-secondary-container',
  'bg-info-container text-on-info-container',
  'bg-warning-container text-on-warning-container',
  'bg-success-container text-on-success-container',
  'bg-error-container text-on-error-container',
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const palette = PALETTE[hashString(name) % PALETTE.length];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase tracking-wide',
        SIZE_CLASSES[size],
        palette,
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
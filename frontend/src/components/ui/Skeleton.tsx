import { cn } from '../../utils/cn';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('skeleton block', ROUNDED[rounded], className)}
      style={{ width, height }}
    />
  );
}
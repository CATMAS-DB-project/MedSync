import type { CSSProperties } from 'react';
import { cn } from '../../utils/cn';

export interface IconProps {
  /** Material Symbols icon name, e.g. "dashboard", "calendar_today". */
  name: string;
  className?: string;
  /** Renders the filled variant of the glyph (used for active/selected states). */
  filled?: boolean;
  size?: number;
}

export function Icon({ name, className, filled = false, size }: IconProps) {
  const style: CSSProperties | undefined = size ? { fontSize: size } : undefined;
  return (
    <span
      className={cn('material-symbols-outlined', filled && 'icon-fill', className)}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

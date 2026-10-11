import { useRef } from 'react';
import { IconButton } from '../../../components/ui/IconButton';
import { cn } from '../../../utils/cn';

export interface DateStripProps {
  days: string[];
  value: string;
  onChange: (iso: string) => void;
  today: string;
  minDate?: string;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function DateStrip({
  days,
  value,
  onChange,
  today,
  minDate,
}: DateStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  const scrollStrip = (direction: 'left' | 'right') => {
    stripRef.current?.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth',
    });
  };

  return (
    <div
      role="group"
      aria-label="Select a date"
      className="flex items-center gap-2"
    >
      <IconButton
        icon="chevron_left"
        size="sm"
        aria-label="Scroll days left"
        onClick={() => scrollStrip('left')}
        className="hidden sm:inline-flex"
      />
      <div ref={stripRef} className="flex flex-1 gap-2 overflow-x-auto pb-1">
        {days.map((iso) => {
          const d = parseIso(iso);
          const isToday = iso === today;
          const isSelected = iso === value;
          const isDisabled = minDate !== undefined && iso < minDate;
          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(iso)}
              aria-pressed={isSelected}
              className={cn(
                'flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-2xl px-2.5 py-2 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isSelected
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high',
                isDisabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <span
                className={cn(
                  'text-label-sm uppercase tracking-wider',
                  isSelected ? 'text-on-primary/80' : 'text-on-surface-variant',
                )}
              >
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span
                className={cn(
                  'text-body-md font-semibold',
                  isToday && !isSelected && 'text-primary',
                )}
              >
                {String(d.getDate()).padStart(2, '0')}
              </span>
            </button>
          );
        })}
      </div>
      <IconButton
        icon="chevron_right"
        size="sm"
        aria-label="Scroll days right"
        onClick={() => scrollStrip('right')}
        className="hidden sm:inline-flex"
      />
    </div>
  );
}

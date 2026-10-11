import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatTime } from '../../../utils/formatters';
import { nowHHMM, todayIso } from '../../../utils/dates';
import { cn } from '../../../utils/cn';
import type { AvailabilitySlot } from '../../../types';

export interface SlotGridProps {
  slots: AvailabilitySlot[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedTime: string | null;
  onSelect: (time: string) => void;
  /** The date these slots are for — used to hide/disable past times on today. */
  date: string;
}

export function SlotGrid({
  slots,
  loading,
  error,
  onRetry,
  selectedTime,
  onSelect,
  date,
}: SlotGridProps) {
  if (error) {
    return <ErrorBanner message={error} onRetry={onRetry} />;
  }

  if (loading && slots.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} height={40} rounded="xl" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return <EmptyState icon="schedule" title="No slots on this day" />;
  }

  const isToday = date === todayIso();
  const now = nowHHMM();

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {slots.map((slot) => {
        const isPast = isToday && slot.time <= now;
        const isDisabled = !slot.available || isPast;
        const isSelected = selectedTime === slot.time;

        return (
          <button
            key={slot.time}
            type="button"
            disabled={isDisabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(slot.time)}
            className={cn(
              'h-10 rounded-xl px-2 text-label-md font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isDisabled
                ? 'cursor-not-allowed bg-surface-container-low text-on-surface-variant/50 line-through'
                : isSelected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-primary-container/40',
            )}
          >
            {formatTime(slot.time)}
          </button>
        );
      })}
    </div>
  );
}

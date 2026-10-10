import { useState } from 'react';
import { todayIso, daysAgoIso } from '../../../utils/dates';

export { daysAgoIso };

export interface DateRange {
  from: string;
  to: string;
}

export type PresetOption = '7d' | '30d' | 'custom';

interface DateRangeControlProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeControl({ value, onChange }: DateRangeControlProps) {
  const [preset, setPreset] = useState<PresetOption>('7d');
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const [dateError, setDateError] = useState<string | null>(null);

  const handlePresetChange = (newPreset: PresetOption) => {
    setPreset(newPreset);
    setDateError(null);
    const today = todayIso();

    if (newPreset === '7d') {
      const from = daysAgoIso(6);
      setCustomFrom(from);
      setCustomTo(today);
      onChange({ from, to: today });
    } else if (newPreset === '30d') {
      const from = daysAgoIso(29);
      setCustomFrom(from);
      setCustomTo(today);
      onChange({ from, to: today });
    }
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);

    if (!from || !to) {
      setDateError('Both start and end dates are required.');
      return;
    }

    if (from > to) {
      setDateError('Start date must be before or equal to end date.');
      return;
    }

    setDateError(null);
    onChange({ from, to });
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div
        className="inline-flex max-w-full flex-wrap rounded-xl border border-outline-variant bg-surface-container-low p-1 shadow-sm"
        role="group"
        aria-label="Dashboard date range"
      >
        <button
          type="button"
          onClick={() => handlePresetChange('7d')}
          aria-pressed={preset === '7d'}
          className={`rounded-md px-3 py-1.5 text-label-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
            preset === '7d'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => handlePresetChange('30d')}
          aria-pressed={preset === '30d'}
          className={`rounded-md px-3 py-1.5 text-label-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
            preset === '30d'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          Last 30 Days
        </button>
        <button
          type="button"
          onClick={() => handlePresetChange('custom')}
          aria-pressed={preset === 'custom'}
          className={`rounded-md px-3 py-1.5 text-label-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
            preset === 'custom'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          Custom
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-sm">
          <input
            type="date"
            value={customFrom}
            max={todayIso()}
            onChange={(e) => handleCustomDateChange(e.target.value, customTo)}
            className="min-h-10 min-w-0 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Start date"
          />
          <span className="text-label-md text-on-surface-variant">to</span>
          <input
            type="date"
            value={customTo}
            max={todayIso()}
            onChange={(e) => handleCustomDateChange(customFrom, e.target.value)}
            className="min-h-10 min-w-0 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="End date"
          />
        </div>
      )}

      {dateError && (
        <span className="text-body-sm font-medium text-error" role="alert">{dateError}</span>
      )}
    </div>
  );
}

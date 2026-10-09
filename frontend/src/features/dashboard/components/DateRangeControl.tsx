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
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="inline-flex rounded-lg border border-outline-variant p-0.5 bg-surface-container-low">
        <button
          type="button"
          onClick={() => handlePresetChange('7d')}
          className={`px-3 py-1.5 text-label-md rounded-md font-medium transition-colors ${
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
          className={`px-3 py-1.5 text-label-md rounded-md font-medium transition-colors ${
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
          className={`px-3 py-1.5 text-label-md rounded-md font-medium transition-colors ${
            preset === 'custom'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          Custom
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={todayIso()}
            onChange={(e) => handleCustomDateChange(e.target.value, customTo)}
            className="rounded border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Start date"
          />
          <span className="text-body-sm text-on-surface-variant">to</span>
          <input
            type="date"
            value={customTo}
            max={todayIso()}
            onChange={(e) => handleCustomDateChange(customFrom, e.target.value)}
            className="rounded border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="End date"
          />
        </div>
      )}

      {dateError && (
        <span className="text-body-sm text-error font-medium">{dateError}</span>
      )}
    </div>
  );
}


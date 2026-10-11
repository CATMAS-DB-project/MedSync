import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/Select';
import type { SelectOption } from '../../../components/ui/Select';

export type RangePreset = '7d' | '30d' | '90d' | 'custom';

const PRESET_ITEMS: TabItem<RangePreset>[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'custom', label: 'Custom' },
];

export interface DashboardFiltersProps {
  preset: RangePreset;
  onPresetChange: (next: RangePreset) => void;

  from: string;
  to: string;
  onFromChange: (iso: string) => void;
  onToChange: (iso: string) => void;

  showBranchSelect: boolean;
  branchValue: string;
  branchOptions: SelectOption[];
  onBranchChange: (next: string) => void;

  onRefresh: () => void;
  isRefreshing: boolean;
}

export function DashboardFilters({
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  showBranchSelect,
  branchValue,
  branchOptions,
  onBranchChange,
  onRefresh,
  isRefreshing,
}: DashboardFiltersProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <SegmentedControl<RangePreset>
        ariaLabel="Date range"
        items={PRESET_ITEMS}
        value={preset}
        onChange={onPresetChange}
      />

      {preset === 'custom' && (
        <>
          <div className="w-40">
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => onFromChange(e.target.value)}
              aria-label="From date"
              containerClassName="gap-0"
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => onToChange(e.target.value)}
              aria-label="To date"
              containerClassName="gap-0"
            />
          </div>
        </>
      )}

      {showBranchSelect && (
        <div className="w-52">
          <Select
            aria-label="Branch"
            value={branchValue}
            onChange={(e) => onBranchChange(e.target.value)}
            options={branchOptions}
          />
        </div>
      )}

      <IconButton
        icon={isRefreshing ? 'progress_activity' : 'refresh'}
        aria-label="Refresh"
        onClick={onRefresh}
        className={isRefreshing ? 'animate-spin' : undefined}
      />

      {/* Keeps the refresh icon from looking detached on very narrow screens. */}
      <span className="sr-only" aria-live="polite">
        {isRefreshing ? 'Refreshing' : ''}
      </span>
    </div>
  );
}


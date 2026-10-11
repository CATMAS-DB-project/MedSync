import { SegmentedControl } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { SelectOption } from '../../../components/ui/Select';

export type AppointmentsView = 'list' | 'calendar';

export interface AppointmentToolbarProps {
  view: AppointmentsView;
  onViewChange: (view: AppointmentsView) => void;
  date: string;
  onDateChange: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  dateLabel: string;

  showBranchSelect: boolean;
  branchId: string;
  branchOptions: SelectOption[];
  onBranchChange: (value: string) => void;

  showDoctorSelect: boolean;
  doctorId: string;
  doctorOptions: SelectOption[];
  onDoctorChange: (value: string) => void;
}

export function AppointmentToolbar({
  view,
  onViewChange,
  date,
  onDateChange,
  onPrev,
  onNext,
  onToday,
  dateLabel,
  showBranchSelect,
  branchId,
  branchOptions,
  onBranchChange,
  showDoctorSelect,
  doctorId,
  doctorOptions,
  onDoctorChange,
}: AppointmentToolbarProps) {
  return (
    <section className="rounded-2xl bg-surface-container-lowest p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl<AppointmentsView>
          ariaLabel="View mode"
          value={view}
          onChange={onViewChange}
          items={[
            { value: 'list', label: 'List' },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-surface-container-low p-1">
            <IconButton
              icon="chevron_left"
              size="sm"
              aria-label={view === 'calendar' ? 'Previous week' : 'Previous day'}
              onClick={onPrev}
            />
            <Button variant="ghost" size="sm" onClick={onToday}>
              Today
            </Button>
            <IconButton
              icon="chevron_right"
              size="sm"
              aria-label={view === 'calendar' ? 'Next week' : 'Next day'}
              onClick={onNext}
            />
          </div>

          <div className="min-w-[10.5rem]">
            <Input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              aria-label="Selected date"
              containerClassName="gap-0"
            />
          </div>

          <span className="hidden text-label-md text-on-surface-variant sm:inline">
            {dateLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        {showDoctorSelect && (
          <div className="sm:w-56">
            <Select
              label="Doctor"
              value={doctorId}
              onChange={(event) => onDoctorChange(event.target.value)}
              options={doctorOptions}
            />
          </div>
        )}

        {showBranchSelect && (
          <div className="sm:w-56">
            <Select
              label="Branch"
              value={branchId}
              onChange={(event) => onBranchChange(event.target.value)}
              options={branchOptions}
            />
          </div>
        )}

        <span className="text-label-md text-on-surface-variant lg:hidden">{dateLabel}</span>
      </div>
    </section>
  );
}

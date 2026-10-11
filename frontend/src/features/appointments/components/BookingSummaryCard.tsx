import { Button } from '../../../components/ui/Button';
import { formatCurrency, formatDate, formatTime } from '../../../utils/formatters';

export interface BookingSummaryCardProps {
  patientName: string | null;
  doctorName: string | null;
  branchName: string | null;
  date: string | null;
  time: string | null;
  fee: number | null;
  onConfirm: () => void;
  isPending: boolean;
  disabled: boolean;
  showConfirm?: boolean;
}

export function BookingSummaryCard({
  patientName,
  doctorName,
  branchName,
  date,
  time,
  fee,
  onConfirm,
  isPending,
  disabled,
  showConfirm = true,
}: BookingSummaryCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
      <h2 className="text-headline-sm text-on-surface">Summary</h2>

      <dl className="flex flex-col gap-2.5">
        <SummaryRow label="Patient" value={patientName ?? '—'} />
        <SummaryRow
          label="Doctor"
          value={doctorName ? `Dr. ${doctorName}` : '—'}
        />
        <SummaryRow label="Branch" value={branchName ?? '—'} />
        <SummaryRow label="Date" value={date ? formatDate(date) : '—'} />
        <SummaryRow label="Time" value={time ? formatTime(time) : '—'} />
        <SummaryRow
          label="Fee"
          value={fee !== null ? formatCurrency(fee) : '—'}
          emphasized
        />
      </dl>

      {showConfirm && (
        <Button
          variant="primary"
          className="w-full"
          isLoading={isPending}
          disabled={disabled}
          onClick={onConfirm}
        >
          Confirm booking
        </Button>
      )}
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  emphasized?: boolean;
}

function SummaryRow({ label, value, emphasized = false }: SummaryRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 pb-2 last:border-b-0">
      <dt className="shrink-0 text-label-md text-on-surface-variant">{label}</dt>
      <dd
        className={
          emphasized
            ? 'min-w-0 truncate text-right text-body-sm font-semibold text-on-surface'
            : 'min-w-0 truncate text-right text-body-sm text-on-surface'
        }
      >
        {value}
      </dd>
    </div>
  );
}

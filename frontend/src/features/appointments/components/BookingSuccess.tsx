import type { ReactNode } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { formatCurrency, formatDate, formatTime } from '../../../utils/formatters';

export interface BookingSuccessProps {
  patientName: string;
  doctorName: string;
  branchName: string;
  date: string;
  time: string;
  fee: number;
  title?: string;
  extra?: ReactNode;
  onBookAnother: () => void;
  onViewAppointments: () => void;
}

export function BookingSuccess({
  patientName,
  doctorName,
  branchName,
  date,
  time,
  fee,
  title = 'Appointment booked',
  extra,
  onBookAnother,
  onViewAppointments,
}: BookingSuccessProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl bg-surface-container-lowest p-6 shadow-card sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-on-success-container">
          <Icon name="check_circle" filled size={28} />
        </span>
        <h2 className="text-headline-md text-on-surface">{title}</h2>
      </div>

      <dl className="flex flex-col gap-2.5 rounded-2xl bg-surface-container-low p-4">
        <Row label="Patient" value={patientName} />
        <Row label="Doctor" value={`Dr. ${doctorName}`} />
        <Row label="Branch" value={branchName} />
        <Row label="Date" value={formatDate(date)} />
        <Row label="Time" value={formatTime(time)} />
        <Row label="Fee" value={formatCurrency(fee)} emphasized />
      </dl>

      {extra}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBookAnother}>
          Book another
        </Button>
        <Button variant="primary" icon="calendar_month" onClick={onViewAppointments}>
          View appointments
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
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

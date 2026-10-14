import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui/Button';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { Payment } from '../../../types';

export interface ReceiptModalProps {
  payment: Payment | null;
  invoiceId: number | null;
  patientName: string | null;
  onClose: () => void;
}

function dateTimeLabel(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)} · ${hh}:${mm}`;
}

export function ReceiptModal({
  payment,
  invoiceId,
  patientName,
  onClose,
}: ReceiptModalProps) {
  return (
    <Modal
      isOpen={payment !== null}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            icon="print"
            onClick={() => window.print()}
            className="no-print"
          >
            Print
          </Button>
        </>
      }
    >
      {payment && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            {/* TODO: replace with logo image */}
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary"
            >
              M
            </span>
            <span className="text-headline-sm font-bold tracking-tight text-on-surface">
              Medsync
            </span>
          </div>

          <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Payment receipt
          </h2>

          <div className="my-1 w-full border-t border-dashed border-outline-variant" />

          <dl className="flex w-full flex-col gap-1.5">
            <Row label="Receipt no" value={`#${payment.paymentId}`} />
            <Row label="Date" value={dateTimeLabel(payment.paymentDate)} />
            <Row label="Patient" value={patientName ?? '—'} />
            <Row
              label="Invoice"
              value={invoiceId !== null ? `#${invoiceId}` : '—'}
            />
            <Row label="Method" value={payment.paymentMethod} />
          </dl>

          <div className="my-1 w-full border-t border-dashed border-outline-variant" />

          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Amount paid
            </span>
            <span className="text-headline-md font-bold text-on-surface">
              {formatCurrency(payment.amountPaid)}
            </span>
          </div>

          <div className="my-1 w-full border-t border-dashed border-outline-variant" />

          <p className="text-label-md text-on-surface-variant">Thank you</p>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-label-md text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 truncate text-right text-body-sm text-on-surface">
        {value}
      </dd>
    </div>
  );
}

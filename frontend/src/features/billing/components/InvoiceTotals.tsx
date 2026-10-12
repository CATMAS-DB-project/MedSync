import { formatCurrency } from '../../../utils/formatters';
import type { Invoice } from '../../../types';

export interface InvoiceTotalsProps {
  invoice: Invoice;
}

export function InvoiceTotals({ invoice }: InvoiceTotalsProps) {
  const isDraft = invoice.status === 'Draft';
  const showInsurance = !isDraft || invoice.insuranceDeduction !== 0;
  const showDiscount = !isDraft || invoice.manualDiscount !== 0;
  const outstanding = invoice.outstandingAmount ?? 0;
  const outstandingProblem = outstanding > 0 && !isDraft;

  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <dl className="flex flex-col gap-1.5">
        <Row label="Subtotal" value={formatCurrency(invoice.subtotalAmount)} />
        {showInsurance && (
          <Row
            label="Insurance deduction"
            value={formatCurrency(invoice.insuranceDeduction)}
          />
        )}
        {showDiscount && (
          <Row
            label="Manual discount"
            value={formatCurrency(invoice.manualDiscount)}
          />
        )}
        <Row
          label="Payable"
          value={formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
          strong
        />
        {!isDraft && (
          <Row label="Paid" value={formatCurrency(invoice.amountPaid ?? 0)} />
        )}
        {!isDraft && (
          <Row
            label="Outstanding"
            value={formatCurrency(outstanding)}
            strong
            tone={outstandingProblem ? 'error' : undefined}
          />
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'error';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1 last:border-b-0">
      <dt className="text-label-md text-on-surface-variant">{label}</dt>
      <dd
        className={[
          'text-body-sm tabular-nums',
          strong ? 'font-semibold' : '',
          tone === 'error' ? 'text-error' : 'text-on-surface',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

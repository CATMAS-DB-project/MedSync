import { Badge } from '../../../components/ui/Badge';
import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { Payment } from '../../../types';

export interface InvoicePaymentsListProps {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenReceipt: (payment: Payment) => void;
}

function shortDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)} · ${hh}:${mm}`;
}

export function InvoicePaymentsList({
  payments,
  loading,
  error,
  onRetry,
  onOpenReceipt,
}: InvoicePaymentsListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        Payments
      </h3>

      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && payments.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={48} rounded="xl" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState icon="payments" title="No payments yet" />
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant/60 overflow-hidden rounded-2xl bg-surface-container-low">
          {payments.map((payment) => (
            <li
              key={payment.paymentId}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface">
                  <span className="font-medium tabular-nums">
                    {formatCurrency(payment.amountPaid)}
                  </span>
                  <Badge tone="primary" pill>
                    {payment.paymentMethod}
                  </Badge>
                </div>
                <div className="mt-0.5 text-label-md text-on-surface-variant">
                  {shortDateTime(payment.paymentDate)}
                </div>
              </div>
              <IconButton
                icon="receipt"
                size="sm"
                aria-label="View receipt"
                onClick={() => onOpenReceipt(payment)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

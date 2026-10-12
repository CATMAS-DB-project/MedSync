import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ApiError } from '../../../services/api/ApiError';
import { recordPayment } from '../../../services/api/payments';
import { formatCurrency } from '../../../utils/formatters';
import type { InvoiceDetail, Payment, PaymentMethod } from '../../../types';

export interface InvoicePaymentFormProps {
  invoice: InvoiceDetail;
  onSuccess: (payment: Payment) => void;
  autoFocus?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const METHOD_OPTIONS: TabItem<PaymentMethod>[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Credit Card', label: 'Credit Card' },
  { value: 'Insurance', label: 'Insurance' },
];

export function InvoicePaymentForm({
  invoice,
  onSuccess,
  autoFocus = false,
}: InvoicePaymentFormProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAmount(
      invoice.outstandingAmount !== undefined ? String(invoice.outstandingAmount) : '',
    );
    setMethod('Cash');
    setError(null);
  }, [invoice.invoiceId, invoice.status, invoice.outstandingAmount]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.focus();
  }, [autoFocus, invoice.invoiceId]);

  const outstanding = invoice.outstandingAmount ?? 0;

  const handleSubmit = async () => {
    if (isPending) return;
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    if (round2(amt) > round2(outstanding)) {
      setError(
        `Payment cannot exceed the outstanding balance (${formatCurrency(outstanding)}).`,
      );
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const payment = await recordPayment(invoice.invoiceId, {
        amountPaid: round2(amt),
        paymentMethod: method,
      });
      onSuccess(payment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
      <h3 className="text-headline-sm text-on-surface">Record payment</h3>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Input
        ref={inputRef}
        label="Amount"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-label-md font-medium text-on-surface">Method</span>
        <SegmentedControl<PaymentMethod>
          items={METHOD_OPTIONS}
          value={method}
          onChange={setMethod}
          ariaLabel="Payment method"
        />
      </div>

      <Button
        variant="primary"
        onClick={handleSubmit}
        isLoading={isPending}
        disabled={isPending}
        className="w-full"
      >
        Record payment
      </Button>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ApiError } from '../../../services/api/ApiError';
import { finalizeInvoice } from '../../../services/api/invoices';
import { formatCurrency } from '../../../utils/formatters';
import type { InvoiceDetail } from '../../../types';

export interface InvoiceFinalizeFormProps {
  invoice: InvoiceDetail;
  approvedInsuranceAmount: number;
  onSuccess: () => void;
  autoFocus?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function InvoiceFinalizeForm({
  invoice,
  approvedInsuranceAmount,
  onSuccess,
  autoFocus = false,
}: InvoiceFinalizeFormProps) {
  const [insuranceDeduction, setInsuranceDeduction] = useState('0');
  const [manualDiscount, setManualDiscount] = useState('0');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInsuranceDeduction(
      approvedInsuranceAmount > 0 ? String(approvedInsuranceAmount) : '0',
    );
    setManualDiscount('0');
    setError(null);
  }, [invoice.invoiceId, approvedInsuranceAmount]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.focus();
  }, [autoFocus, invoice.invoiceId]);

  const ins = Number(insuranceDeduction) || 0;
  const disc = Number(manualDiscount) || 0;
  const preview = round2(Math.max(0, invoice.subtotalAmount - ins - disc));

  const validate = (): string | null => {
    if (ins < 0 || disc < 0) return 'Amounts cannot be negative.';
    if (ins > approvedInsuranceAmount) {
      return 'Insurance deduction cannot exceed the approved claim amount.';
    }
    if (ins + disc > invoice.subtotalAmount) {
      return 'Deductions and discount cannot exceed the subtotal.';
    }
    return null;
  };

  const handleOpenConfirm = () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await finalizeInvoice(invoice.invoiceId, {
        insuranceDeduction: ins,
        manualDiscount: disc,
      });
      setIsConfirmOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finalize the invoice.');
      setIsConfirmOpen(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
      <h3 className="text-headline-sm text-on-surface">Finalize</h3>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Input
        ref={inputRef}
        label="Insurance deduction"
        type="number"
        min="0"
        step="0.01"
        value={insuranceDeduction}
        onChange={(e) => setInsuranceDeduction(e.target.value)}
      />
      <Input
        label="Manual discount"
        type="number"
        min="0"
        step="0.01"
        value={manualDiscount}
        onChange={(e) => setManualDiscount(e.target.value)}
      />

      <div className="rounded-xl bg-primary-container/40 px-3 py-2 text-body-sm">
        <span className="text-on-surface-variant">Payable after adjustments: </span>
        <span className="font-semibold text-on-surface">{formatCurrency(preview)}</span>
      </div>

      <Button
        variant="primary"
        onClick={handleOpenConfirm}
        disabled={isPending}
        className="w-full"
      >
        Finalize invoice
      </Button>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Finalize invoice?"
        message="It cannot be edited afterwards."
        confirmLabel="Finalize"
        cancelLabel="Cancel"
        tone="default"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          setIsConfirmOpen(false);
        }}
      />
    </div>
  );
}
